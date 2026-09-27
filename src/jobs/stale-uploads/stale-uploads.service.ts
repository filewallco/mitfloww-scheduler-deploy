import { and, asc, eq, gt, isNull, lte } from "drizzle-orm";
import type { DatabaseClient } from "../../database/client.js";
import { files } from "../../database/schema.js";
import { FileUploadStatusDb } from "../../types/schema-enums.js";
import type { R2Cleaner } from "../../storage/r2-cleaner.js";
import type { JobContext, JobResult } from "../../core/job.interface.js";
import { env } from "../../config/env.js";

export class StaleUploadsService {
  constructor(
    private dbClient: DatabaseClient,
    private r2Cleaner: R2Cleaner
  ) {}

  async processStaleUploads(ctx: JobContext): Promise<JobResult> {
    const db = this.dbClient.db;
    const now = new Date();
    const thresholdMs = env.STALE_UPLOAD_RETENTION_HOURS * 60 * 60 * 1000;
    const thresholdDate = new Date(now.getTime() - thresholdMs);

    const result: JobResult = {
      scanned: 0,
      eligible: 0,
      processed: 0,
      deleted: 0,
      skipped: 0,
      failed: 0,
    };

    // 1. Abort abandoned R2 multipart uploads exceeding grace period
    try {
      const activeMultipartUploads = await this.r2Cleaner.listMultipartUploads(undefined, env.R2_BUCKET_NAME);
      result.scanned += activeMultipartUploads.length;

      for (const upload of activeMultipartUploads) {
        if (ctx.signal.aborted) break;

        if (upload.initiatedAt && upload.initiatedAt.getTime() < thresholdDate.getTime()) {
          result.eligible += 1;
          const aborted = await this.r2Cleaner.abortMultipartUpload(
            upload.key,
            upload.uploadId,
            env.R2_BUCKET_NAME,
            ctx.dryRun
          );

          if (aborted) {
            result.deleted += 1;
            result.processed += 1;
            ctx.logger.info(`[StaleUploads] Aborted stale multipart upload for key "${upload.key}"`);
          } else {
            result.failed += 1;
          }
        } else {
          result.skipped += 1;
        }
      }
    } catch (err) {
      ctx.logger.error("[StaleUploads] Error listing multipart uploads from R2", { error: err });
    }

    // 2. Identify abandoned DB upload records stuck in "Uploading" beyond grace period with no completed versions
    let cursorId: string | null = null;
    const batchSize = env.SCHEDULER_BATCH_SIZE;

    while (true) {
      if (ctx.signal.aborted) break;

      const staleFiles = await db
        .select({
          id: files.id,
          storageKey: files.storageKey,
          currentVersionId: files.currentVersionId,
          createdAt: files.createdAt,
        })
        .from(files)
        .where(
          and(
            cursorId ? gt(files.id, cursorId) : undefined,
            eq(files.uploadStatus, FileUploadStatusDb.Uploading),
            lte(files.createdAt, thresholdDate),
            isNull(files.currentVersionId)
          )
        )
        .orderBy(asc(files.id))
        .limit(batchSize);

      if (staleFiles.length === 0) break;
      result.scanned += staleFiles.length;

      for (const f of staleFiles) {
        if (ctx.signal.aborted) break;
        result.eligible += 1;

        try {
          if (f.storageKey) {
            await this.r2Cleaner.deleteObjects([f.storageKey], env.R2_BUCKET_NAME, ctx.dryRun);
            result.deleted += 1;
          }

          if (!ctx.dryRun) {
            await db
              .update(files)
              .set({ uploadStatus: FileUploadStatusDb.Failed, deletedAt: now, updatedAt: now })
              .where(eq(files.id, f.id));
          }

          result.processed += 1;
        } catch (err) {
          result.failed += 1;
          ctx.logger.error(`[StaleUploads] Failed to clean up stale upload record "${f.id}"`, { error: err });
        }
      }

      cursorId = staleFiles[staleFiles.length - 1].id;
      if (staleFiles.length < batchSize) break;
    }

    return result;
  }
}
