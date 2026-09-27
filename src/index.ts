import { env, loadEnv } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { dbClient } from "./database/client.js";
import { r2Client, testR2Connection } from "./storage/r2-client.js";
import { R2Cleaner } from "./storage/r2-cleaner.js";
import { PostgresAdvisoryLockProvider } from "./core/locking/postgres-advisory-lock.js";
import { JobRegistry } from "./core/job-registry.js";
import { JobRunner } from "./core/job-runner.js";
import { SchedulerService } from "./core/scheduler.js";
import { HealthServer } from "./health/health-server.js";

// Jobs & Services
import { ExpiredProjectsService } from "./jobs/expired-projects/expired-projects.service.js";
import { ExpiredProjectsJob } from "./jobs/expired-projects/expired-projects.job.js";
import { RevisionLifecycleService } from "./jobs/revision-lifecycle/revision-lifecycle.service.js";
import { RevisionLifecycleJob } from "./jobs/revision-lifecycle/revision-lifecycle.job.js";
import { StaleUploadsService } from "./jobs/stale-uploads/stale-uploads.service.js";
import { StaleUploadsJob } from "./jobs/stale-uploads/stale-uploads.job.js";
import { OrphanedProcessedFilesService } from "./jobs/orphaned-processed-files/orphaned-processed-files.service.js";
import { OrphanedProcessedFilesJob } from "./jobs/orphaned-processed-files/orphaned-processed-files.job.js";
import { SoftDeletedAssetsService } from "./jobs/soft-deleted-assets/soft-deleted-assets.service.js";
import { SoftDeletedAssetsJob } from "./jobs/soft-deleted-assets/soft-deleted-assets.job.js";
import { DeletedUsersService } from "./jobs/deleted-users/deleted-users.service.js";
import { DeletedUsersJob } from "./jobs/deleted-users/deleted-users.job.js";
import { LogRetentionService } from "./jobs/log-retention/log-retention.service.js";
import { LogRetentionJob } from "./jobs/log-retention/log-retention.job.js";

async function main() {
  logger.info("================================================================================");
  logger.info("Starting MitFloww Production Scheduler & Maintenance Service...");
  logger.info("================================================================================");

  // 1. Validate environment configuration
  const config = loadEnv();

  if (config.DRY_RUN) {
    logger.warn("********************************************************************************");
    logger.warn("  SCHEDULER RUNNING IN DRY_RUN MODE. NO DESTRUCTIVE ACTIONS WILL BE EXECUTED.  ");
    logger.warn("********************************************************************************");
  }

  logger.info("Environment configuration validated successfully.", {
    nodeEnv: config.NODE_ENV,
    dryRun: config.DRY_RUN,
    tickIntervalMs: config.SCHEDULER_TICK_INTERVAL_MS,
    batchSize: config.SCHEDULER_BATCH_SIZE,
    accountRetentionDays: config.ACCOUNT_DELETION_RETENTION_DAYS,
    staleUploadRetentionHours: config.STALE_UPLOAD_RETENTION_HOURS,
    orphanedFileRetentionHours: config.ORPHANED_FILE_RETENTION_HOURS,
    softDeletedAssetRetentionDays: config.SOFT_DELETED_ASSET_RETENTION_DAYS,
    resolvedReportRetentionDays: config.RESOLVED_REPORT_RETENTION_DAYS,
  });

  // 2. Test database connectivity and verify authoritative MitFloww schema
  const dbConnected = await dbClient.healthCheck();
  if (!dbConnected) {
    logger.error("[Startup] Failed to connect to PostgreSQL database. Exiting.");
    process.exit(1);
  }

  try {
    await dbClient.ensureSchemaAndTables();
  } catch (schemaErr) {
    logger.error("[Startup] Failed schema verification check", { error: schemaErr });
    process.exit(1);
  }

  // 3. Test R2 storage connectivity
  const r2Connected = await testR2Connection(r2Client, config.R2_BUCKET_NAME);
  if (!r2Connected) {
    logger.warn("[Startup] R2 connection check failed. Verify credentials in .env.");
  } else {
    logger.info("[Startup] Cloudflare R2 bucket connection verified.");
  }

  // 4. Initialize core components
  const lockProvider = new PostgresAdvisoryLockProvider(dbClient.getPool());
  const r2Cleaner = new R2Cleaner(r2Client, config.R2_BUCKET_NAME);

  const registry = new JobRegistry();
  // Pass dbClient to JobRunner so execution history is persistently recorded in PostgreSQL
  const runner = new JobRunner(lockProvider, dbClient);
  const scheduler = new SchedulerService(registry, runner);

  // 5. Initialize services and register scheduled jobs
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

  logger.info(`[Startup] Registered ${registry.getAll().length} cleanup & maintenance jobs.`);

  // 6. Start health check HTTP server & Admin Operations Console
  let healthServer: HealthServer | null = null;
  if (config.HEALTH_SERVER_ENABLED) {
    healthServer = new HealthServer(config.HEALTH_SERVER_PORT, dbClient, runner, scheduler, registry);
    healthServer.start();
  }

  // 7. Start scheduler loop
  scheduler.start();

  // 8. Graceful shutdown handler
  let isShuttingDown = false;
  const gracefulShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`[Shutdown] Received ${signal}. Initiating graceful shutdown...`);

    try {
      // Stop scheduling new jobs
      await scheduler.stop();

      // Stop health server
      if (healthServer) {
        await healthServer.stop();
      }

      // Close database connection pool
      await dbClient.close();

      logger.info("[Shutdown] All services stopped cleanly. Exiting.");
      process.exit(0);
    } catch (err) {
      logger.error("[Shutdown] Error during graceful shutdown", { error: err });
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => void gracefulShutdown("SIGINT"));

  process.on("uncaughtException", (err) => {
    logger.error("[Fatal] Uncaught exception in scheduler process", { error: err });
    void gracefulShutdown("uncaughtException");
  });

  process.on("unhandledRejection", (reason) => {
    logger.error("[Fatal] Unhandled promise rejection in scheduler process", { error: reason });
  });
}

main().catch((err) => {
  logger.error("[Fatal] Fatal error initializing scheduler application", { error: err });
  process.exit(1);
});
