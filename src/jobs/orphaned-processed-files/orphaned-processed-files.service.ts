import { and, asc, eq, gt, inArray, isNotNull, lte, notInArray } from "drizzle-orm";
import type { DatabaseClient } from "../../database/client.js";
import { fileVersions } from "../../database/schema.js";
import { FileProcessingStatusDb } from "../../types/schema-enums.js";
import type { R2Cleaner } from "../../storage/r2-cleaner.js";
import type { JobContext, JobResult } from "../../core/job.interface.js";
import { env } from "../../config/env.js";

export class OrphanedProcessedFilesService {
  constructor(
    private dbClient: DatabaseClient,
    private r2Cleaner: R2Cleaner
  ) {}

  async processOrphanedFiles(ctx: JobContext): Promise<JobResult> {
    const db = this.dbClient.db;
    const now = new Date();
    const thresholdMs = env.ORPHANED_FILE_RETENTION_HOURS * 60 * 60 * 1000;
    const thresholdDate = new Date(now.getTime() - thresholdMs);

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

    // Keyset pagination on fileVersions.id
    while (true) {
      if (ctx.signal.aborted) break;

      const staleFailedVersions = await db
        .select({
          id: fileVersions.id,
          processedStorageKey: fileVersions.processedStorageKey,
          processedStorageBucket: fileVersions.processedStorageBucket,
          processingStatus: fileVersions.processingStatus,
          updatedAt: fileVersions.updatedAt,
        })
        .from(fileVersions)
        .where(
          and(
            cursorId ? gt(fileVersions.id, cursorId) : undefined,
            inArray(fileVersions.processingStatus, [
              FileProcessingStatusDb.Failed,
              FileProcessingStatusDb.Cancelled,
              FileProcessingStatusDb.Corrupt,
            ]),
            isNotNull(fileVersions.processedStorageKey),
            lte(fileVersions.updatedAt, thresholdDate)
          )
        )
        .orderBy(asc(fileVersions.id))
        .limit(batchSize);

      if (staleFailedVersions.length === 0) break;
      result.scanned += staleFailedVersions.length;

      for (const version of staleFailedVersions) {
        if (ctx.signal.aborted) break;
        if (!version.processedStorageKey) continue;

        // Defensive Verification 1: Ensure NO active version references this exact processedStorageKey
        const activeVersionUsingKey = await db
          .select({ id: fileVersions.id })
          .from(fileVersions)
          .where(
            and(
              eq(fileVersions.processedStorageKey, version.processedStorageKey),
              notInArray(fileVersions.processingStatus, [
                FileProcessingStatusDb.Failed,
                FileProcessingStatusDb.Cancelled,
                FileProcessingStatusDb.Corrupt,
              ])
            )
          )
          .limit(1);

        if (activeVersionUsingKey.length > 0) {
          ctx.logger.warn(`[OrphanedFiles] Skipping key "${version.processedStorageKey}": referenced by another non-failed version.`);
          result.skipped += 1;
          continue;
        }

        // Defensive Verification 2: Atomic Claim to Eliminate Worker Race Condition
        // If a worker retries or re-queues this file right now, processingStatus or updatedAt changes.
        // We atomically clear processedStorageKey only if the status and updatedAt are still unchanged.
        if (!ctx.dryRun) {
          const claim = await db
            .update(fileVersions)
            .set({ processedStorageKey: null, updatedAt: now })
            .where(
              and(
                eq(fileVersions.id, version.id),
                inArray(fileVersions.processingStatus, [
                  FileProcessingStatusDb.Failed,
                  FileProcessingStatusDb.Cancelled,
                  FileProcessingStatusDb.Corrupt,
                ]),
                lte(fileVersions.updatedAt, thresholdDate)
              )
            )
            .returning({ id: fileVersions.id });

          if (claim.length === 0) {
            ctx.logger.warn(`[OrphanedFiles] Version "${version.id}" was modified or retried concurrently by worker. Aborting R2 deletion.`);
            result.skipped += 1;
            continue;
          }
        }

        result.eligible += 1;

        try {
          const targetBucket = version.processedStorageBucket || env.R2_BUCKET_NAME;
          const delRes = await this.r2Cleaner.deleteObjects(
            [version.processedStorageKey],
            targetBucket,
            ctx.dryRun,
            ctx.signal
          );

          result.deleted += delRes.deletedCount;
          result.processed += 1;
          ctx.logger.info(`[OrphanedFiles] Cleaned up orphaned processed artifact "${version.processedStorageKey}" from bucket "${targetBucket}"`);
        } catch (err) {
          result.failed += 1;
          ctx.logger.error(`[OrphanedFiles] Failed to clean processed key "${version.processedStorageKey}"`, { error: err });
        }
      }

      cursorId = staleFailedVersions[staleFailedVersions.length - 1].id;
      if (staleFailedVersions.length < batchSize) break;
    }

    return result;
  }
}
