import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import type { DistributedLockProvider } from "./locking/lock.interface.js";
import type { JobContext, JobExecutionStatus, JobResult, SchedulerJob } from "./job.interface.js";
import { schedulerJobRuns } from "../database/schema.js";
import { SchedulerJobStatus } from "../types/schema-enums.js";
import type { DatabaseClient } from "../database/client.js";
import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";

/**
 * Sanitizes and truncates error messages to avoid leaking credentials or blowing DB field limits.
 */
function sanitizeErrorMessage(msg: string): string {
  // Mask connection strings or tokens if accidentally embedded in stack/error
  const sanitized = msg
    .replace(new RegExp('(postgresql|postgres|https?)://[^@]+@', 'gi'), '$1://***:***@')
    .replace(new RegExp('(Bearer|token|secret|accessKeyId|secretAccessKey)\\s*[:=]\\s*[^\\s,]+', 'gi'), '$1=***');
  return sanitized.length > 1000 ? sanitized.substring(0, 997) + '...' : sanitized;
}

function sanitizeDetails(details?: Record<string, unknown>): string | null {
  if (!details) return null;
  try {
    const str = JSON.stringify(details);
    return str.length > 2000 ? str.substring(0, 1997) + "..." : str;
  } catch {
    return null;
  }
}

export class JobRunner {
  private statusMap = new Map<string, JobExecutionStatus>();
  private activeControllers = new Set<AbortController>();
  private inFlightExecutions = 0;

  constructor(
    private lockProvider: DistributedLockProvider,
    private dbClient?: DatabaseClient
  ) {}

  getStatus(jobName: string): JobExecutionStatus {
    const existing = this.statusMap.get(jobName);
    if (existing) return existing;

    const initial: JobExecutionStatus = {
      name: jobName,
      lastRunAt: null,
      lastCompletedAt: null,
      lastDurationMs: null,
      lastStatus: SchedulerJobStatus.Idle,
      lastError: null,
      lastResult: null,
      consecutiveFailures: 0,
    };
    this.statusMap.set(jobName, initial);
    return initial;
  }

  getAllStatuses(): Record<string, JobExecutionStatus> {
    const result: Record<string, JobExecutionStatus> = {};
    for (const [name, status] of this.statusMap.entries()) {
      result[name] = status;
    }
    return result;
  }

  getInFlightCount(): number {
    return this.inFlightExecutions;
  }

  /**
   * Aborts all active job executions and waits up to timeoutMs for in-flight tasks to terminate.
   */
  async stopAll(timeoutMs = 10000): Promise<void> {
    logger.info(`[JobRunner] Signalling abort to ${this.activeControllers.size} active jobs...`);
    for (const controller of this.activeControllers) {
      try {
        controller.abort();
      } catch (err) {
        logger.debug("[JobRunner] Error aborting job controller", { error: err });
      }
    }

    const startWait = Date.now();
    while (this.inFlightExecutions > 0 && Date.now() - startWait < timeoutMs) {
      await new Promise((r) => setTimeout(r, 100));
    }

    if (this.inFlightExecutions > 0) {
      logger.warn(`[JobRunner] ${this.inFlightExecutions} jobs still in-flight after ${timeoutMs}ms shutdown timeout.`);
    } else {
      logger.info("[JobRunner] All jobs completed or exited cleanly.");
    }
  }

  async runJob(job: SchedulerJob): Promise<JobResult | null> {
    const jobStatus = this.getStatus(job.name);
    if (jobStatus.lastStatus === SchedulerJobStatus.Running) {
      logger.debug(`[JobRunner] Job "${job.name}" is already running locally. Skipping tick.`);
      return null;
    }

    const executionId = crypto.randomUUID();
    const jobLogger = logger.child({ executionId, jobName: job.name });

    // 1. Try to acquire distributed lock
    const lockKey = `scheduler:lock:${job.name}`;
    const lock = await this.lockProvider.acquire(lockKey, env.LOCK_TTL_MS);

    if (!lock) {
      jobLogger.debug(`[JobRunner] Could not acquire distributed lock for "${job.name}". Another instance is currently executing it.`);
      jobStatus.lastStatus = SchedulerJobStatus.Locked;
      return null;
    }

    const startedAt = new Date();
    jobStatus.lastStatus = SchedulerJobStatus.Running;
    jobStatus.lastRunAt = startedAt;
    this.inFlightExecutions++;

    jobLogger.info(`[JobRunner] Starting job "${job.name}"`, {
      description: job.description,
      dryRun: env.DRY_RUN,
    });

    // Record persistent run start in database (non-blocking)
    if (this.dbClient) {
      try {
        await this.dbClient.db.insert(schedulerJobRuns).values({
          executionId,
          jobName: job.name,
          status: SchedulerJobStatus.Running,
          startedAt,
        });
      } catch (dbErr) {
        jobLogger.debug("[JobRunner] Could not record job start to database", { error: dbErr });
      }
    }

    const abortController = new AbortController();
    this.activeControllers.add(abortController);

    const ctx: JobContext = {
      executionId,
      jobName: job.name,
      dryRun: env.DRY_RUN,
      logger: jobLogger,
      startedAt,
      signal: abortController.signal,
    };

    let result: JobResult = {
      scanned: 0,
      eligible: 0,
      processed: 0,
      deleted: 0,
      skipped: 0,
      failed: 0,
    };

    try {
      result = await job.execute(ctx);
      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();

      jobStatus.lastStatus = SchedulerJobStatus.Success;
      jobStatus.lastCompletedAt = completedAt;
      jobStatus.lastDurationMs = durationMs;
      jobStatus.lastError = null;
      jobStatus.lastResult = result;
      jobStatus.consecutiveFailures = 0;

      jobLogger.info(`[JobRunner] Completed job "${job.name}" successfully in ${durationMs}ms`, {
        durationMs,
        ...result,
      });

      // Update persistent run record with success metrics
      if (this.dbClient) {
        try {
          await this.dbClient.db
            .update(schedulerJobRuns)
            .set({
              status: SchedulerJobStatus.Success,
              completedAt,
              durationMs,
              recordsScanned: result.scanned,
              recordsEligible: result.eligible,
              recordsProcessed: result.processed,
              recordsDeleted: result.deleted,
              recordsSkipped: result.skipped,
              recordsFailed: result.failed,
              details: sanitizeDetails(result.details),
            })
            .where(eq(schedulerJobRuns.executionId, executionId));
        } catch (dbErr) {
          jobLogger.debug("[JobRunner] Could not record job completion to database", { error: dbErr });
        }
      }

      return result;
    } catch (err) {
      const completedAt = new Date();
      const durationMs = completedAt.getTime() - startedAt.getTime();
      const rawError = err instanceof Error ? err.message : String(err);
      const errorMessage = sanitizeErrorMessage(rawError);

      jobStatus.lastStatus = SchedulerJobStatus.Failed;
      jobStatus.lastCompletedAt = completedAt;
      jobStatus.lastDurationMs = durationMs;
      jobStatus.lastError = errorMessage;
      jobStatus.consecutiveFailures += 1;

      jobLogger.error(`[JobRunner] Job "${job.name}" failed after ${durationMs}ms: ${errorMessage}`, {
        durationMs,
        error: err,
        ...result,
      });

      // Update persistent run record with failure metrics
      if (this.dbClient) {
        try {
          await this.dbClient.db
            .update(schedulerJobRuns)
            .set({
              status: SchedulerJobStatus.Failed,
              completedAt,
              durationMs,
              recordsScanned: result.scanned,
              recordsEligible: result.eligible,
              recordsProcessed: result.processed,
              recordsDeleted: result.deleted,
              recordsSkipped: result.skipped,
              recordsFailed: result.failed,
              errorMessage,
              details: sanitizeDetails(result.details),
            })
            .where(eq(schedulerJobRuns.executionId, executionId));
        } catch (dbErr) {
          jobLogger.debug("[JobRunner] Could not record job failure to database", { error: dbErr });
        }
      }

      return null;
    } finally {
      this.activeControllers.delete(abortController);
      this.inFlightExecutions = Math.max(0, this.inFlightExecutions - 1);
      try {
        await lock.release();
      } catch (unlockErr) {
        jobLogger.warn(`[JobRunner] Error releasing lock for "${job.name}"`, { error: unlockErr });
      }
    }
  }
}
