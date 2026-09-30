import { loadEnv } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { dbClient, type DatabaseClient } from "../database/client.js";
import { r2Client, testR2Connection } from "../storage/r2-client.js";
import { R2Cleaner } from "../storage/r2-cleaner.js";
import { PostgresAdvisoryLockProvider } from "./locking/postgres-advisory-lock.js";
import { JobRegistry } from "./job-registry.js";
import { JobRunner } from "./job-runner.js";
import { SchedulerService } from "./scheduler.js";
import { ApiRouter } from "../api/router.js";

import { ExpiredProjectsService } from "../jobs/expired-projects/expired-projects.service.js";
import { ExpiredProjectsJob } from "../jobs/expired-projects/expired-projects.job.js";
import { RevisionLifecycleService } from "../jobs/revision-lifecycle/revision-lifecycle.service.js";
import { RevisionLifecycleJob } from "../jobs/revision-lifecycle/revision-lifecycle.job.js";
import { StaleUploadsService } from "../jobs/stale-uploads/stale-uploads.service.js";
import { StaleUploadsJob } from "../jobs/stale-uploads/stale-uploads.job.js";
import { OrphanedProcessedFilesService } from "../jobs/orphaned-processed-files/orphaned-processed-files.service.js";
import { OrphanedProcessedFilesJob } from "../jobs/orphaned-processed-files/orphaned-processed-files.job.js";
import { SoftDeletedAssetsService } from "../jobs/soft-deleted-assets/soft-deleted-assets.service.js";
import { SoftDeletedAssetsJob } from "../jobs/soft-deleted-assets/soft-deleted-assets.job.js";
import { DeletedUsersService } from "../jobs/deleted-users/deleted-users.service.js";
import { DeletedUsersJob } from "../jobs/deleted-users/deleted-users.job.js";
import { LogRetentionService } from "../jobs/log-retention/log-retention.service.js";
import { LogRetentionJob } from "../jobs/log-retention/log-retention.job.js";

export interface AppContext {
  config: ReturnType<typeof loadEnv>;
  dbClient: DatabaseClient;
  lockProvider: PostgresAdvisoryLockProvider;
  r2Cleaner: R2Cleaner;
  registry: JobRegistry;
  runner: JobRunner;
  scheduler: SchedulerService;
  router: ApiRouter;
  startedAt: Date;
}

let cachedContext: AppContext | null = null;
let initPromise: Promise<AppContext> | null = null;

/**
 * Initializes all core services, database connections, and cleanup jobs in a singleton pattern.
 * Safe for both continuous daemon processes and serverless (Vercel) environments.
 */
export async function getAppContext(): Promise<AppContext> {
  if (cachedContext) {
    return cachedContext;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const config = loadEnv();
    const startedAt = new Date();

    // 1. Verify DB connectivity & schema
    const dbConnected = await dbClient.healthCheck();
    if (!dbConnected) {
      throw new Error("[Startup] Failed to connect to PostgreSQL database.");
    }

    try {
      await dbClient.ensureSchemaAndTables();
    } catch (schemaErr) {
      logger.error("[Startup] Failed schema verification check", { error: schemaErr });
      throw schemaErr;
    }

    // 2. Test R2 storage connectivity (warn only if non-fatal)
    const r2Connected = await testR2Connection(r2Client, config.R2_BUCKET_NAME);
    if (!r2Connected) {
      logger.warn("[Startup] R2 connection check failed. Verify credentials in environment.");
    }

    // 3. Core dependencies
    const lockProvider = new PostgresAdvisoryLockProvider(dbClient.getPool());
    const r2Cleaner = new R2Cleaner(r2Client, config.R2_BUCKET_NAME);
    const registry = new JobRegistry();
    const runner = new JobRunner(lockProvider, dbClient);
    const scheduler = new SchedulerService(registry, runner);

    // 4. Register all maintenance jobs
    const expiredProjectsService = new ExpiredProjectsService(dbClient, r2Cleaner);
    const revisionLifecycleService = new RevisionLifecycleService(dbClient, r2Cleaner);
    const staleUploadsService = new StaleUploadsService(dbClient, r2Cleaner);
    const orphanedFilesService = new OrphanedProcessedFilesService(dbClient, r2Cleaner);
    const softDeletedAssetsService = new SoftDeletedAssetsService(dbClient, r2Cleaner);
    const deletedUsersService = new DeletedUsersService(dbClient, r2Cleaner);
    const logRetentionService = new LogRetentionService(dbClient);

    registry
      .register(new ExpiredProjectsJob(expiredProjectsService))
      .register(new RevisionLifecycleJob(revisionLifecycleService))
      .register(new StaleUploadsJob(staleUploadsService))
      .register(new OrphanedProcessedFilesJob(orphanedFilesService))
      .register(new SoftDeletedAssetsJob(softDeletedAssetsService))
      .register(new DeletedUsersJob(deletedUsersService))
      .register(new LogRetentionJob(logRetentionService));

    // 5. Create API router
    const router = new ApiRouter({
      dbClient,
      runner,
      scheduler,
      registry,
      startedAt,
    });

    cachedContext = {
      config,
      dbClient,
      lockProvider,
      r2Cleaner,
      registry,
      runner,
      scheduler,
      router,
      startedAt,
    };

    return cachedContext;
  })();

  return initPromise;
}
