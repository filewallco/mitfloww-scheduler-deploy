function isValidUserId(userId: unknown): boolean {
  if (typeof userId !== "string") return false;
  const trimmed = userId.trim();
  if (trimmed.length === 0 || trimmed.length > 255) return false;
  if (trimmed.includes("..") || trimmed.includes("/") || trimmed.includes("\\")) return false;
  return /^[a-zA-Z0-9_\-]+$/.test(trimmed);
}

import { and, asc, eq, gt, inArray, isNotNull, lte, or } from "drizzle-orm";
import type { DatabaseClient } from "../../database/client.js";
import {
  assetFiles,
  assetPreviewFiles,
  assetPurchases,
  assets,
  authIdentities,
  companies,
  creditAccounts,
  files,
  fileVersions,
  fileVersionReports,
  revisionComments,
  otpChallenges,
  projects,
  sessions,
  storageAccounts,
  users,
} from "../../database/schema.js";
import { UserStatusDb } from "../../types/schema-enums.js";
import type { R2Cleaner } from "../../storage/r2-cleaner.js";
import type { JobContext, JobResult } from "../../core/job.interface.js";
import { env } from "../../config/env.js";

export class DeletedUsersService {
  constructor(
    private dbClient: DatabaseClient,
    private r2Cleaner: R2Cleaner
  ) {}

  async processDeletedUsers(ctx: JobContext): Promise<JobResult> {
    const db = this.dbClient.db;
    const now = new Date();
    const accountRetentionThreshold = new Date(
      now.getTime() - env.ACCOUNT_DELETION_RETENTION_DAYS * 24 * 60 * 60 * 1000
    );

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

    // Keyset pagination over users
    while (true) {
      if (ctx.signal.aborted) break;

      const candidateUsers = await db
        .select({
          id: users.id,
          email: users.email,
          avatarStorageKey: users.avatarStorageKey,
          deletedAt: users.deletedAt,
          status: users.status,
        })
        .from(users)
        .where(
          and(
            cursorId ? gt(users.id, cursorId) : undefined,
            or(
              isNotNull(users.deletedAt),
              eq(users.status, UserStatusDb.Deactivated)
            )
          )
        )
        .orderBy(asc(users.id))
        .limit(batchSize);

      if (candidateUsers.length === 0) break;
      result.scanned += candidateUsers.length;

      for (const user of candidateUsers) {
        if (ctx.signal.aborted) break;

        const userDeletedAt = user.deletedAt ?? now;
        const isPastAccountRetention = userDeletedAt.getTime() <= accountRetentionThreshold.getTime();

        try {
          if (!isPastAccountRetention) {
            // =========================================================================
            // Case 1: Account within retention period (< 30 days)
            // Project expiry occurs before account retention limit:
            // Check if any projects owned by this user have expired. Clean their R2 files,
            // but retain the account profile data until retention period expires.
            // =========================================================================
            const userExpiredProjects = await db
              .select({
                id: projects.id,
                shareExpiresAt: projects.shareExpiresAt,
                deletedAt: projects.deletedAt,
              })
              .from(projects)
              .where(
                and(
                  eq(projects.userId, user.id),
                  or(
                    and(isNotNull(projects.shareExpiresAt), lte(projects.shareExpiresAt, now)),
                    isNotNull(projects.deletedAt)
                  )
                )
              );

            if (userExpiredProjects.length > 0) {
              result.eligible += 1;
              ctx.logger.info(`[DeletedUsers] Case 1: User ${user.id} has ${userExpiredProjects.length} expired projects. Cleaning project R2 files while retaining account.`);

              for (const proj of userExpiredProjects) {
                const projectPrefix = `users/${user.id}/projects/${proj.id}/`;
                try {
                  const delRes = await this.r2Cleaner.deletePrefix(projectPrefix, env.R2_BUCKET_NAME, ctx.dryRun);
                  result.deleted += delRes.deletedCount;
                } catch (err) {
                  ctx.logger.warn(`[DeletedUsers] Error deleting project prefix ${projectPrefix}`, { error: err });
                }
              }
              result.processed += 1;
            } else {
              result.skipped += 1;
            }
          } else {
            // =========================================================================
            // Case 2: Account retention period expired (>= 30 days)
            // Resumable Staged Deletion: Can safely crash at any stage and resume.
            // =========================================================================
            result.eligible += 1;
            ctx.logger.info(`[DeletedUsers] Case 2: Account retention expired for user ${user.id}. Executing staged permanent purge.`);

            // --- STAGE 2A: Clean user projects in keyset batches ---
            let projCursor: string | null = null;
            while (true) {
              const userProjects = await db
                .select({ id: projects.id })
                .from(projects)
                .where(
                  and(
                    eq(projects.userId, user.id),
                    projCursor ? gt(projects.id, projCursor) : undefined
                  )
                )
                .orderBy(asc(projects.id))
                .limit(50);

              if (userProjects.length === 0) break;

              for (const proj of userProjects) {
                // Delete project R2 prefix
                const projectPrefix = `users/${user.id}/projects/${proj.id}/`;
                try {
                  const delRes = await this.r2Cleaner.deletePrefix(projectPrefix, env.R2_BUCKET_NAME, ctx.dryRun);
                  result.deleted += delRes.deletedCount;
                } catch (err) {
                  ctx.logger.debug(`[DeletedUsers] Project prefix delete warning: ${projectPrefix}`, { error: err });
                }

                // Delete project reports, comments, files & versions from DB (satisfies restrict onDelete foreign keys)
                if (!ctx.dryRun) {
                  await db.delete(fileVersionReports).where(eq(fileVersionReports.projectId, proj.id));
                  await db.delete(revisionComments).where(eq(revisionComments.projectId, proj.id));

                  const pFiles = await db.select({ id: files.id }).from(files).where(eq(files.projectId, proj.id));
                  if (pFiles.length > 0) {
                    const fIds = pFiles.map((f) => f.id);
                    await db.delete(fileVersions).where(inArray(fileVersions.fileId, fIds));
                    await db.delete(files).where(inArray(files.id, fIds));
                  }
                  await db.delete(projects).where(eq(projects.id, proj.id));
                }
              }

              projCursor = userProjects[userProjects.length - 1].id;
              if (userProjects.length < 50) break;
            }

            // --- STAGE 2B: Clean user assets in keyset batches ---
            let assetCursor: string | null = null;
            while (true) {
              const userAssets = await db
                .select({ id: assets.id })
                .from(assets)
                .where(
                  and(
                    eq(assets.userId, user.id),
                    assetCursor ? gt(assets.id, assetCursor) : undefined
                  )
                )
                .orderBy(asc(assets.id))
                .limit(50);

              if (userAssets.length === 0) break;

              for (const ast of userAssets) {
                // Collect and delete asset storage files
                const afList = await db.select({ storageKey: assetFiles.storageKey }).from(assetFiles).where(eq(assetFiles.assetId, ast.id));
                const apList = await db.select({ storageKey: assetPreviewFiles.storageKey }).from(assetPreviewFiles).where(eq(assetPreviewFiles.assetId, ast.id));

                const astKeys = [...afList.map((f) => f.storageKey), ...apList.map((p) => p.storageKey)].filter(Boolean);
                if (astKeys.length > 0) {
                  const delRes = await this.r2Cleaner.deleteObjects(astKeys, env.ASSETS_BUCKET_NAME, ctx.dryRun);
                  result.deleted += delRes.deletedCount;
                }

                if (!ctx.dryRun) {
                  await db.delete(assetFiles).where(eq(assetFiles.assetId, ast.id));
                  await db.delete(assetPreviewFiles).where(eq(assetPreviewFiles.assetId, ast.id));
                  await db.delete(assetPurchases).where(eq(assetPurchases.assetId, ast.id));
                  await db.delete(assets).where(eq(assets.id, ast.id));
                }
              }

              assetCursor = userAssets[userAssets.length - 1].id;
              if (userAssets.length < 50) break;
            }

            // --- STAGE 2C: Avatar & Company Logos ---
            const brandKeys: string[] = [];
            if (user.avatarStorageKey) brandKeys.push(user.avatarStorageKey);

            const userCompanies = await db
              .select({ id: companies.id, logoStorageKey: companies.logoStorageKey })
              .from(companies)
              .where(eq(companies.userId, user.id));

            for (const c of userCompanies) {
              if (c.logoStorageKey) brandKeys.push(c.logoStorageKey);
            }

            if (brandKeys.length > 0) {
              const delRes = await this.r2Cleaner.deleteObjects(brandKeys, env.R2_BUCKET_NAME, ctx.dryRun);
              result.deleted += delRes.deletedCount;
            }

            // --- STAGE 2D: Clean full user namespace R2 prefix ---
            const userPrefix = `users/${user.id}/`;
            try {
              const prefixRes = await this.r2Cleaner.deletePrefix(userPrefix, env.R2_BUCKET_NAME, ctx.dryRun);
              result.deleted += prefixRes.deletedCount;
            } catch (err) {
              ctx.logger.warn(`[DeletedUsers] Error deleting user prefix ${userPrefix} in files bucket`, { error: err });
            }

            try {
              const assetsPrefixRes = await this.r2Cleaner.deletePrefix(userPrefix, env.ASSETS_BUCKET_NAME, ctx.dryRun);
              result.deleted += assetsPrefixRes.deletedCount;
            } catch (err) {
              ctx.logger.debug(`[DeletedUsers] Assets prefix empty or missing: ${userPrefix}`);
            }

            // --- STAGE 2E: Final Database Cascade & User Purge ---
            if (!ctx.dryRun) {
              await db.delete(creditAccounts).where(eq(creditAccounts.ownerUserId, user.id));
              await db.delete(storageAccounts).where(eq(storageAccounts.ownerUserId, user.id));
              await db.delete(sessions).where(eq(sessions.userId, user.id));
              await db.delete(authIdentities).where(eq(authIdentities.userId, user.id));
              await db.delete(otpChallenges).where(eq(otpChallenges.userId, user.id));
              await db.delete(companies).where(eq(companies.userId, user.id));

              // Final permanent delete of user record
              await db.delete(users).where(eq(users.id, user.id));
            }

            result.processed += 1;
            ctx.logger.info(`[DeletedUsers] Complete staged purge completed for user ${user.id}`);
          }
        } catch (err) {
          result.failed += 1;
          ctx.logger.error(`[DeletedUsers] Error processing deleted user ${user.id}`, { error: err });
        }
      }

      cursorId = candidateUsers[candidateUsers.length - 1].id;
      if (candidateUsers.length < batchSize) break;
    }

    return result;
  }
}
