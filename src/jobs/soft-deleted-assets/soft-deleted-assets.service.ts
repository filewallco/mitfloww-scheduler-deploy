import { and, asc, eq, gt, isNotNull, lte } from "drizzle-orm";
import type { DatabaseClient } from "../../database/client.js";
import { assetFiles, assetPreviewFiles, assetPurchases, assets } from "../../database/schema.js";
import type { R2Cleaner } from "../../storage/r2-cleaner.js";
import type { JobContext, JobResult } from "../../core/job.interface.js";
import { env } from "../../config/env.js";

export class SoftDeletedAssetsService {
  constructor(
    private dbClient: DatabaseClient,
    private r2Cleaner: R2Cleaner
  ) {}

  async processSoftDeletedAssets(ctx: JobContext): Promise<JobResult> {
    const db = this.dbClient.db;
    const now = new Date();
    const retentionThreshold = new Date(now.getTime() - env.SOFT_DELETED_ASSET_RETENTION_DAYS * 24 * 60 * 60 * 1000);

    const result: JobResult = {
      scanned: 0,
      eligible: 0,
      processed: 0,
      deleted: 0,
      skipped: 0,
      failed: 0,
    };

    let cursorId: string | null = null;
    const batchSize = env.SCHEDULER_BATCH_SIZE;

    // Keyset pagination on assets.id
    while (true) {
      if (ctx.signal.aborted) break;

      const candidateAssets = await db
        .select({
          id: assets.id,
          userId: assets.userId,
          title: assets.title,
          deletedAt: assets.deletedAt,
        })
        .from(assets)
        .where(
          and(
            cursorId ? gt(assets.id, cursorId) : undefined,
            isNotNull(assets.deletedAt),
            lte(assets.deletedAt, retentionThreshold)
          )
        )
        .orderBy(asc(assets.id))
        .limit(batchSize);

      if (candidateAssets.length === 0) break;
      result.scanned += candidateAssets.length;

      for (const asset of candidateAssets) {
        if (ctx.signal.aborted) break;
        result.eligible += 1;

        try {
          // Collect files and previews for this asset
          const rawFiles = await db
            .select({ storageKey: assetFiles.storageKey })
            .from(assetFiles)
            .where(eq(assetFiles.assetId, asset.id));

          const rawPreviews = await db
            .select({ storageKey: assetPreviewFiles.storageKey })
            .from(assetPreviewFiles)
            .where(eq(assetPreviewFiles.assetId, asset.id));

          const filesList = Array.isArray(rawFiles) ? rawFiles : [];
          const previewsList = Array.isArray(rawPreviews) ? rawPreviews : [];
          const keysToDelete = new Set<string>();
          for (const f of filesList) {
            if (f.storageKey) keysToDelete.add(f.storageKey);
          }
          for (const p of previewsList) {
            if (p.storageKey) keysToDelete.add(p.storageKey);
          }

          // Delete from R2 in batch
          const keyArray = Array.from(keysToDelete);
          if (keyArray.length > 0) {
            const delRes = await this.r2Cleaner.deleteObjects(keyArray, env.ASSETS_BUCKET_NAME, ctx.dryRun);
            result.deleted += delRes.deletedCount;
            result.failed += delRes.failedCount;
          }

          // Delete asset records from database (cascades assetFiles & assetPreviewFiles)
          if (!ctx.dryRun) {
            await db.delete(assetFiles).where(eq(assetFiles.assetId, asset.id));
            await db.delete(assetPreviewFiles).where(eq(assetPreviewFiles.assetId, asset.id));
            await db.delete(assetPurchases).where(eq(assetPurchases.assetId, asset.id));
            await db.delete(assets).where(eq(assets.id, asset.id));
          }

          result.processed += 1;
          ctx.logger.info(`[SoftDeletedAssets] Permanently deleted asset "${asset.id}" (${asset.title}) and ${keyArray.length} storage objects`);
        } catch (err) {
          result.failed += 1;
          ctx.logger.error(`[SoftDeletedAssets] Failed to permanently delete asset "${asset.id}"`, { error: err });
        }
      }

      cursorId = candidateAssets[candidateAssets.length - 1].id;
      if (candidateAssets.length < batchSize) break;
    }

    return result;
  }
}
