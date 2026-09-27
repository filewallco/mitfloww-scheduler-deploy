import { and, asc, eq, gt, inArray, isNotNull, isNull, lte } from "drizzle-orm";
import type { DatabaseClient } from "../../database/client.js";
import { fileVersionReports, fileVersions } from "../../database/schema.js";
import { FileVersionReportStatusDb } from "../../types/schema-enums.js";
import type { R2Cleaner } from "../../storage/r2-cleaner.js";
import type { JobContext, JobResult } from "../../core/job.interface.js";
import { env } from "../../config/env.js";

export class RevisionLifecycleService {
  constructor(
    private dbClient: DatabaseClient,
    private r2Cleaner: R2Cleaner
  ) {}

  async processRevisionLifecycle(ctx: JobContext): Promise<JobResult> {
    const db = this.dbClient.db;
    const now = new Date();

    const result: JobResult = {
      scanned: 0,
      eligible: 0,
      processed: 0,
      deleted: 0,
      skipped: 0,
      failed: 0,
    };

    const batchSize = env.SCHEDULER_BATCH_SIZE;

    // 1. Process expired previews (previewRetentionUntil <= now AND previewPurgedAt IS NULL) via keyset pagination
    let versionCursor: string | null = null;
    while (true) {
      if (ctx.signal.aborted) break;

      const expiredPreviewVersions = await db
        .select({
          id: fileVersions.id,
          previewStorageKey: fileVersions.previewStorageKey,
          previewStorageBucket: fileVersions.previewStorageBucket,
          previewRetentionUntil: fileVersions.previewRetentionUntil,
        })
        .from(fileVersions)
        .where(
          and(
            versionCursor ? gt(fileVersions.id, versionCursor) : undefined,
            isNotNull(fileVersions.previewRetentionUntil),
            lte(fileVersions.previewRetentionUntil, now),
            isNull(fileVersions.previewPurgedAt),
            isNotNull(fileVersions.previewStorageKey)
          )
        )
        .orderBy(asc(fileVersions.id))
        .limit(batchSize);

      if (expiredPreviewVersions.length === 0) break;
      result.scanned += expiredPreviewVersions.length;

      // Group keys by target bucket
      const keysByBucket = new Map<string, string[]>();
      const purgedVersionIds: string[] = [];

      for (const v of expiredPreviewVersions) {
        if (v.previewStorageKey) {
          const bucket = v.previewStorageBucket || env.R2_BUCKET_NAME;
          const list = keysByBucket.get(bucket) ?? [];
          list.push(v.previewStorageKey);
          keysByBucket.set(bucket, list);
          purgedVersionIds.push(v.id);
        }
      }

      let totalKeysToDelete = 0;
      for (const [bucket, keys] of keysByBucket.entries()) {
        totalKeysToDelete += keys.length;
        result.eligible += keys.length;
        const delRes = await this.r2Cleaner.deleteObjects(keys, bucket, ctx.dryRun);
        result.deleted += delRes.deletedCount;
        result.failed += delRes.failedCount;
      }

      if (totalKeysToDelete > 0) {
        if (!ctx.dryRun && purgedVersionIds.length > 0) {
          await db
            .update(fileVersions)
            .set({ previewPurgedAt: now, previewStorageKey: null, updatedAt: now })
            .where(inArray(fileVersions.id, purgedVersionIds));
        }
        result.processed += purgedVersionIds.length;
      }

      versionCursor = expiredPreviewVersions[expiredPreviewVersions.length - 1].id;
      if (expiredPreviewVersions.length < batchSize) break;
    }

    // 2. Process resolved file report tickets past retention period via keyset pagination
    // NOTE: This ONLY cleans up the report ticket metadata in file_version_reports!
    // It NEVER deletes deliverable files or project assets.
    const reportRetentionThreshold = new Date(now.getTime() - env.RESOLVED_REPORT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    let reportCursor: string | null = null;

    while (true) {
      if (ctx.signal.aborted) break;

      const resolvedReports = await db
        .select({
          id: fileVersionReports.id,
          fileVersionId: fileVersionReports.fileVersionId,
          updatedAt: fileVersionReports.updatedAt,
        })
        .from(fileVersionReports)
        .where(
          and(
            reportCursor ? gt(fileVersionReports.id, reportCursor) : undefined,
            eq(fileVersionReports.status, FileVersionReportStatusDb.Resolved),
            lte(fileVersionReports.updatedAt, reportRetentionThreshold)
          )
        )
        .orderBy(asc(fileVersionReports.id))
        .limit(batchSize);

      if (resolvedReports.length === 0) break;
      result.scanned += resolvedReports.length;

      const reportIds = resolvedReports.map((r) => r.id);
      result.eligible += reportIds.length;

      if (!ctx.dryRun) {
        await db
          .delete(fileVersionReports)
          .where(inArray(fileVersionReports.id, reportIds));
      }
      result.processed += reportIds.length;
      ctx.logger.info(`[RevisionLifecycle] Cleaned up ${reportIds.length} resolved file version report tickets past retention.`);

      reportCursor = resolvedReports[resolvedReports.length - 1].id;
      if (resolvedReports.length < batchSize) break;
    }

    return result;
  }
}
