import {
  AbortMultipartUploadCommand,
  DeleteObjectsCommand,
  ListMultipartUploadsCommand,
  ListObjectsV2Command,
  type S3Client,
} from "@aws-sdk/client-s3";
import { S3_BATCH_DELETE_MAX_KEYS } from "../config/constants.js";
import { chunkArray } from "../utils/batch.js";
import { logger } from "../utils/logger.js";
import { withRetry } from "../core/retry/retry-helper.js";

export interface BatchDeleteResult {
  deletedCount: number;
  failedCount: number;
  errors: Array<{ key: string; message: string }>;
}

export interface StaleMultipartUpload {
  key: string;
  uploadId: string;
  initiatedAt: Date | undefined;
}

export class R2Cleaner {
  constructor(
    private s3: S3Client,
    private defaultBucket: string
  ) {}

  /**
   * Deletes a list of storage keys in batches of up to 1,000 keys per S3 API call.
   * Idempotent: If an object is already missing from R2, S3 reports it as deleted.
   */
  async deleteObjects(
    keys: string[],
    bucket: string = this.defaultBucket,
    dryRun: boolean = false,
    signal?: AbortSignal
  ): Promise<BatchDeleteResult> {
    const validKeys = Array.from(new Set(keys.filter((k) => typeof k === "string" && k.trim().length > 0)));

    if (validKeys.length === 0) {
      return { deletedCount: 0, failedCount: 0, errors: [] };
    }

    if (dryRun) {
      logger.info(`[R2Cleaner] [DRY RUN] Would delete ${validKeys.length} objects from bucket "${bucket}"`, {
        sampleKeys: validKeys.slice(0, 5),
      });
      return { deletedCount: validKeys.length, failedCount: 0, errors: [] };
    }

    const batches = chunkArray(validKeys, S3_BATCH_DELETE_MAX_KEYS);
    let totalDeleted = 0;
    let totalFailed = 0;
    const errors: Array<{ key: string; message: string }> = [];

    for (const batch of batches) {
      try {
        const result = await withRetry(
          async () => {
            return await this.s3.send(
              new DeleteObjectsCommand({
                Bucket: bucket,
                Delete: {
                  Objects: batch.map((key) => ({ Key: key })),
                  Quiet: false,
                },
              })
            );
          },
          { operationName: `batchDelete (${batch.length} keys)`, signal }
        );

        const deleted = result.Deleted?.length ?? 0;
        totalDeleted += deleted;

        if (result.Errors && result.Errors.length > 0) {
          for (const err of result.Errors) {
            totalFailed += 1;
            errors.push({
              key: err.Key || "unknown",
              message: `${err.Code}: ${err.Message}`,
            });
          }
        }
      } catch (err) {
        logger.error("[R2Cleaner] Fatal error during batch delete execution", { error: err });
        totalFailed += batch.length;
        for (const key of batch) {
          errors.push({
            key,
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }

    return {
      deletedCount: totalDeleted,
      failedCount: totalFailed,
      errors,
    };
  }

  /**
   * Safely deletes all objects matching a prefix with pagination and batch deletion.
   * Defensive: refuses to delete empty prefix, root, or unconstrained "users/" prefix.
   */
  async deletePrefix(
    prefix: string,
    bucket: string = this.defaultBucket,
    dryRun: boolean = false,
    signal?: AbortSignal
  ): Promise<BatchDeleteResult> {
    const trimmed = prefix.trim();
    if (
      !trimmed ||
      trimmed === "/" ||
      trimmed === "users" ||
      trimmed === "users/" ||
      trimmed === "projects" ||
      trimmed === "projects/" ||
      trimmed === "assets" ||
      trimmed === "assets/" ||
      trimmed.includes("..") ||
      trimmed.startsWith("/")
    ) {
      throw new Error(`[R2Cleaner] Refusing to delete dangerously broad, relative, or empty prefix: "${prefix}"`);
    }

    let continuationToken: string | undefined;
    let totalDeleted = 0;
    let totalFailed = 0;
    const errors: Array<{ key: string; message: string }> = [];

    do {
      const listCommand = new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: trimmed,
        ContinuationToken: continuationToken,
      });

      const listResult = await withRetry(async () => this.s3.send(listCommand), {
        operationName: `listPrefix (${trimmed})`,
      });

      const keys = (listResult.Contents || []).map((o) => o.Key).filter((k): k is string => Boolean(k));

      if (keys.length > 0) {
        const deleteRes = await this.deleteObjects(keys, bucket, dryRun, signal);
        totalDeleted += deleteRes.deletedCount;
        totalFailed += deleteRes.failedCount;
        errors.push(...deleteRes.errors);
      }

      continuationToken = listResult.NextContinuationToken;
    } while (continuationToken);

    return {
      deletedCount: totalDeleted,
      failedCount: totalFailed,
      errors,
    };
  }

  /**
   * Lists multipart uploads matching a prefix.
   */
  async listMultipartUploads(
    prefix?: string,
    bucket: string = this.defaultBucket
  ): Promise<StaleMultipartUpload[]> {
    let keyMarker: string | undefined;
    let uploadIdMarker: string | undefined;
    const uploads: StaleMultipartUpload[] = [];

    do {
      const command = new ListMultipartUploadsCommand({
        Bucket: bucket,
        Prefix: prefix,
        KeyMarker: keyMarker,
        UploadIdMarker: uploadIdMarker,
      });

      const res = await withRetry(async () => this.s3.send(command), {
        operationName: "listMultipartUploads",
      });

      if (res.Uploads) {
        for (const u of res.Uploads) {
          if (u.Key && u.UploadId) {
            uploads.push({
              key: u.Key,
              uploadId: u.UploadId,
              initiatedAt: u.Initiated,
            });
          }
        }
      }

      keyMarker = res.NextKeyMarker;
      uploadIdMarker = res.NextUploadIdMarker;
    } while (keyMarker || uploadIdMarker);

    return uploads;
  }

  /**
   * Aborts an abandoned multipart upload.
   */
  async abortMultipartUpload(
    key: string,
    uploadId: string,
    bucket: string = this.defaultBucket,
    dryRun: boolean = false,
    signal?: AbortSignal
  ): Promise<boolean> {
    if (dryRun) {
      logger.info(`[R2Cleaner] [DRY RUN] Would abort multipart upload for key "${key}" (uploadId: ${uploadId})`);
      return true;
    }

    try {
      await withRetry(
        async () => {
          await this.s3.send(
            new AbortMultipartUploadCommand({
              Bucket: bucket,
              Key: key,
              UploadId: uploadId,
            })
          );
        },
        { operationName: `abortMultipartUpload (${key})`, signal }
      );
      return true;
    } catch (err) {
      logger.error(`[R2Cleaner] Failed to abort multipart upload for key "${key}"`, { uploadId, error: err });
      return false;
    }
  }
}
