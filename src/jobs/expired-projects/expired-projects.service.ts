import { and, asc, eq, gt, inArray, isNotNull, lte, or } from "drizzle-orm";
import type { DatabaseClient } from "../../database/client.js";
import { files, fileVersions, projects } from "../../database/schema.js";
import { FileProcessingStatusDb, FileUploadStatusDb } from "../../types/schema-enums.js";
import type { R2Cleaner } from "../../storage/r2-cleaner.js";
import type { JobContext, JobResult } from "../../core/job.interface.js";
import { env } from "../../config/env.js";

export class ExpiredProjectsService {
  constructor(
    private dbClient: DatabaseClient,
    private r2Cleaner: R2Cleaner
  ) {}

  async processExpiredProjects(ctx: JobContext): Promise<JobResult> {
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

    let cursorId: string | null = null;
    const batchSize = env.SCHEDULER_BATCH_SIZE;

    // Keyset pagination: WHERE id > lastId ORDER BY id ASC LIMIT batchSize
    // Protects against row-shift drift and unbounded memory usage
    while (true) {
      if (ctx.signal.aborted) break;

      const candidateProjects = await db
        .select({
          id: projects.id,
          userId: projects.userId,
          title: projects.title,
          shareExpiresAt: projects.shareExpiresAt,
          deletedAt: projects.deletedAt,
        })
        .from(projects)
        .where(
          and(
            cursorId ? gt(projects.id, cursorId) : undefined,
            or(
              and(isNotNull(projects.shareExpiresAt), lte(projects.shareExpiresAt, now)),
              isNotNull(projects.deletedAt)
            )
          )
        )
        .orderBy(asc(projects.id))
        .limit(batchSize);

      if (candidateProjects.length === 0) break;
      result.scanned += candidateProjects.length;

      for (const project of candidateProjects) {
        if (ctx.signal.aborted) break;

        try {
          // Safety verification 1: Do NOT delete if any file in project is currently uploading
          const activeUploads = await db
            .select({ id: files.id })
            .from(files)
            .where(
              and(
                eq(files.projectId, project.id),
                eq(files.uploadStatus, FileUploadStatusDb.Uploading)
              )
            )
            .limit(1);

          if (activeUploads.length > 0) {
            ctx.logger.info(`[ExpiredProjects] Skipping project "${project.id}" (${project.title}): has active uploading files.`);
            result.skipped += 1;
            continue;
          }

          // Safety verification 2: Do NOT delete if any file is actively processing in worker
          const activeProcessing = await db
            .select({ id: fileVersions.id })
            .from(fileVersions)
            .innerJoin(files, eq(fileVersions.fileId, files.id))
            .where(
              and(
                eq(files.projectId, project.id),
                inArray(fileVersions.processingStatus, [
                  FileProcessingStatusDb.Queued,
                  FileProcessingStatusDb.Processing,
                  FileProcessingStatusDb.Uploading,
                  FileProcessingStatusDb.Retrying,
                ])
              )
            )
            .limit(1);

          if (activeProcessing.length > 0) {
            ctx.logger.info(`[ExpiredProjects] Skipping project "${project.id}" (${project.title}): has files currently processing in worker.`);
            result.skipped += 1;
            continue;
          }

          result.eligible += 1;

          // Collect all R2 storage keys associated with this project
          const projectFiles = await db
            .select({
              fileId: files.id,
              storageKey: files.storageKey,
            })
            .from(files)
            .where(eq(files.projectId, project.id));

          const keysToDelete = new Set<string>();
          for (const f of projectFiles) {
            if (f.storageKey) keysToDelete.add(f.storageKey);
          }

          if (projectFiles.length > 0) {
            const fileIds = projectFiles.map((f) => f.fileId);
            const versions = await db
              .select({
                id: fileVersions.id,
                storageKey: fileVersions.storageKey,
                previewStorageKey: fileVersions.previewStorageKey,
                processedStorageKey: fileVersions.processedStorageKey,
              })
              .from(fileVersions)
              .where(inArray(fileVersions.fileId, fileIds));

            for (const v of versions) {
              if (v.storageKey) keysToDelete.add(v.storageKey);
              if (v.previewStorageKey) keysToDelete.add(v.previewStorageKey);
              if (v.processedStorageKey) keysToDelete.add(v.processedStorageKey);
            }
          }

          // Delete collected R2 objects in batches
          const keyList = Array.from(keysToDelete);
          if (keyList.length > 0) {
            const delRes = await this.r2Cleaner.deleteObjects(keyList, env.R2_BUCKET_NAME, ctx.dryRun);
            result.deleted += delRes.deletedCount;
            result.failed += delRes.failedCount;
          }

          // Also clean the project R2 prefix folder safely: users/<userId>/projects/<projectId>/
          const projectPrefix = `users/${project.userId}/projects/${project.id}/`;
          try {
            const prefixRes = await this.r2Cleaner.deletePrefix(projectPrefix, env.R2_BUCKET_NAME, ctx.dryRun);
            result.deleted += prefixRes.deletedCount;
          } catch (prefixErr) {
            ctx.logger.debug(`[ExpiredProjects] Prefix delete skipped or empty: ${projectPrefix}`, { error: prefixErr });
          }

          // Mark files as purged in DB
          if (!ctx.dryRun && projectFiles.length > 0) {
            const fileIds = projectFiles.map((f) => f.fileId);
            await db
              .update(fileVersions)
              .set({ previewPurgedAt: now, deletedAt: now })
              .where(inArray(fileVersions.fileId, fileIds));

            await db
              .update(files)
              .set({ deletedAt: now })
              .where(inArray(files.id, fileIds));
          }

          // Update project status / deletedAt
          if (!ctx.dryRun && !project.deletedAt) {
            await db
              .update(projects)
              .set({ deletedAt: now, updatedAt: now })
              .where(eq(projects.id, project.id));
          }

          result.processed += 1;
          ctx.logger.info(`[ExpiredProjects] Cleaned up expired project "${project.id}" (${keyList.length} keys)`);
        } catch (err) {
          result.failed += 1;
          ctx.logger.error(`[ExpiredProjects] Error processing project "${project.id}"`, { error: err });
        }
      }

      cursorId = candidateProjects[candidateProjects.length - 1].id;
      if (candidateProjects.length < batchSize) break;
    }

    return result;
  }
}
