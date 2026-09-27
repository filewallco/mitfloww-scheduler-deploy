import type { DatabaseClient } from "../../database/client.js";
import type { JobContext, JobResult } from "../../core/job.interface.js";
import { logger } from "../../utils/logger.js";

export class LogRetentionService {
  constructor(private dbClient: DatabaseClient) {}

  async purgeExpiredLogs(ctx: JobContext): Promise<JobResult> {
    const startedAt = new Date();
    logger.info(`[LogRetentionService] Starting log retention cleanup [${ctx.executionId}]`, {
      dryRun: ctx.dryRun,
    });

    const retentionConfig = {
      api: Number(process.env.API_LOG_RETENTION_DAYS || 30),
      web: Number(process.env.WEB_LOG_RETENTION_DAYS || 14),
      worker: Number(process.env.WORKER_LOG_RETENTION_DAYS || 14),
      scheduler: Number(process.env.SCHEDULER_LOG_RETENTION_DAYS || 30),
    };

    let totalDeleted = 0;
    const services = ["api", "web", "worker", "scheduler"] as const;

    for (const service of services) {
      if (ctx.signal.aborted) {
        logger.warn(`[LogRetentionService] Execution aborted cooperatively [${ctx.executionId}]`);
        return {
          scanned: totalDeleted,
          eligible: totalDeleted,
          processed: totalDeleted,
          deleted: totalDeleted,
          skipped: 0,
          failed: 0,
          details: { cancelledAt: new Date().toISOString() },
        };
      }

      const days = retentionConfig[service];
      if (ctx.dryRun) {
        logger.info(`[LogRetentionService] DRY_RUN: Would purge ${service}_logs older than ${days} days.`);
      } else {
        const deletedCount = await this.dbClient.purgeServiceLogs(service, days);
        totalDeleted += deletedCount;
        logger.info(`[LogRetentionService] Purged ${deletedCount} rows from ${service}_logs older than ${days} days.`);
      }
    }

    const durationMs = Date.now() - startedAt.getTime();
    logger.info(`[LogRetentionService] Completed log retention cleanup in ${durationMs}ms [${ctx.executionId}]`, {
      totalDeleted,
      dryRun: ctx.dryRun,
    });

    return {
      scanned: totalDeleted,
      eligible: totalDeleted,
      processed: totalDeleted,
      deleted: totalDeleted,
      skipped: 0,
      failed: 0,
      details: {
        totalDeleted,
        retentionConfig,
        durationMs,
      },
    };
  }
}
