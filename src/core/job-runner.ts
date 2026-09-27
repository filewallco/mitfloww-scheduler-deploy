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
  const sanitized = msg
    .replace(new RegExp("(postgresql|postgres|https?)://[^@]+@", "gi"), "$1://***:***@")
    .replace(new RegExp("(Bearer|token|secret|accessKeyId|secretAccessKey)\\s*[:=]\\s*[^\\s,]+", "gi"), "$1=***");
  return sanitized.length > 1000 ? sanitized.substring(0, 997) + "..." : sanitized;
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

export interface ActiveExecution {
  executionId: string;
  jobName: string;
  abortController: AbortController;
  startedAt: Date;
  triggeredBy: "scheduler" | "admin";
  cancelled?: boolean;
}

export interface ActiveExecutionInfo {
  executionId: string;
  jobName: string;
  startedAt: Date;
  elapsedMs: number;
  triggeredBy: "scheduler" | "admin";
  cancelled: boolean;
}

export class JobRunner {
  private statusMap = new Map<string, JobExecutionStatus>();
  private activeExecutions = new Map<string, ActiveExecution>();
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
   * Resets in-memory consecutive failure counter and last error for jobs not currently executing.
   */
  resetConsecutiveFailures(jobName?: string): void {
    if (jobName) {
      const status = this.statusMap.get(jobName);
      if (status && status.lastStatus !== SchedulerJobStatus.Running) {
        status.consecutiveFailures = 0;
        status.lastError = null;
      }
    } else {
      for (const status of this.statusMap.values()) {
        if (status.lastStatus !== SchedulerJobStatus.Running) {
          status.consecutiveFailures = 0;
          status.lastError = null;
        }
      }
    }
  }

  /**
   * Returns list of currently active running executions with elapsed duration.
   */
  getActiveExecutions(): ActiveExecutionInfo[] {
    const now = Date.now();
    const list: ActiveExecutionInfo[] = [];
    for (const exec of this.activeExecutions.values()) {
      list.push({
        executionId: exec.executionId,
        jobName: exec.jobName,
        startedAt: exec.startedAt,
        elapsedMs: Math.max(0, now - exec.startedAt.getTime()),
        triggeredBy: exec.triggeredBy,
        cancelled: Boolean(exec.cancelled),
      });
    }
    return list;
  }

  /**
   * Cooperatively cancels an active job execution by execution ID or job name.
   */
  async cancelExecution(
    identifier: string,
    actor = "admin"
  ): Promise<{ cancelled: boolean; message: string; executionId?: string; jobName?: string }> {
    let target: ActiveExecution | undefined;

    // Search by executionId first
    if (this.activeExecutions.has(identifier)) {
      target = this.activeExecutions.get(identifier);
    } else {
      // Search by jobName
      for (const exec of this.activeExecutions.values()) {
        if (exec.jobName === identifier) {
          target = exec;
          break;
        }
      }
    }

    if (!target) {
      return {
        cancelled: false,
        message: `No active running execution found matching "${identifier}".`,
      };
    }

    if (target.cancelled || target.abortController.signal.aborted) {
      return {
        cancelled: true,
        message: `Execution "${target.executionId}" for job "${target.jobName}" is already cancelling.`,
        executionId: target.executionId,
        jobName: target.jobName,
      };
    }

    target.cancelled = true;
    try {
      target.abortController.abort();
    } catch (abortErr) {
      logger.debug("[JobRunner] Error signalling abort", { error: abortErr });
    }

    logger.warn(`[JobRunner] Cooperative cancellation requested by ${actor} for job "${target.jobName}" (${target.executionId})`);

    if (this.dbClient) {
      await this.dbClient.recordAdminAudit({
        action: "cancel_job",
        jobName: target.jobName,
        executionId: target.executionId,
        actor,
        result: "cancelled",
        metadata: { reason: "Manual cancellation by admin" },
      });
    }

    return {
      cancelled: true,
      message: `Cancellation signal sent to job "${target.jobName}" (${target.executionId}).`,
      executionId: target.executionId,
      jobName: target.jobName,
    };
  }

  /**
   * Aborts all active job executions and waits up to timeoutMs for in-flight tasks to terminate.
   */
  async stopAll(timeoutMs = 10000): Promise<void> {
    logger.info(`[JobRunner] Signalling abort to ${this.activeExecutions.size} active jobs...`);
    for (const exec of this.activeExecutions.values()) {
      try {
        exec.cancelled = true;
        exec.abortController.abort();
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

  async runJob(
    job: SchedulerJob,
    triggeredBy: "scheduler" | "admin" = "scheduler"
  ): Promise<JobResult | null> {
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

    const abortController = new AbortController();
    const activeEntry: ActiveExecution = {
      executionId,
      jobName: job.name,
      abortController,
      startedAt,
      triggeredBy,
    };
    this.activeExecutions.set(executionId, activeEntry);

    jobLogger.info(`[JobRunner] Starting job "${job.name}"`, {
      description: job.description,
      dryRun: env.DRY_RUN,
      triggeredBy,
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

      const wasCancelled = abortController.signal.aborted || activeEntry.cancelled;
      const finalStatus = wasCancelled ? SchedulerJobStatus.Cancelled : SchedulerJobStatus.Success;

      jobStatus.lastStatus = finalStatus;
      jobStatus.lastCompletedAt = completedAt;
      jobStatus.lastDurationMs = durationMs;
      jobStatus.lastError = wasCancelled ? "Job cancelled cooperatively" : null;
      jobStatus.lastResult = result;
      if (!wasCancelled) {
        jobStatus.consecutiveFailures = 0;
      }

      jobLogger.info(
        wasCancelled
          ? `[JobRunner] Job "${job.name}" cancelled cooperatively after ${durationMs}ms`
          : `[JobRunner] Completed job "${job.name}" successfully in ${durationMs}ms`,
        {
          durationMs,
          status: finalStatus,
          ...result,
        }
      );

      // Update persistent run record with success/cancellation metrics
      if (this.dbClient) {
        try {
          await this.dbClient.db
            .update(schedulerJobRuns)
            .set({
              status: finalStatus,
              completedAt,
              durationMs,
              recordsScanned: result.scanned,
              recordsEligible: result.eligible,
              recordsProcessed: result.processed,
              recordsDeleted: result.deleted,
              recordsSkipped: result.skipped,
              recordsFailed: result.failed,
              errorMessage: wasCancelled ? "Job cancelled cooperatively" : null,
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

      const wasCancelled = abortController.signal.aborted || activeEntry.cancelled;
      const finalStatus = wasCancelled ? SchedulerJobStatus.Cancelled : SchedulerJobStatus.Failed;

      jobStatus.lastStatus = finalStatus;
      jobStatus.lastCompletedAt = completedAt;
      jobStatus.lastDurationMs = durationMs;
      jobStatus.lastError = errorMessage;
      if (!wasCancelled) {
        jobStatus.consecutiveFailures += 1;
      }

      jobLogger.error(`[JobRunner] Job "${job.name}" ${wasCancelled ? "cancelled" : "failed"} after ${durationMs}ms: ${errorMessage}`, {
        durationMs,
        status: finalStatus,
        error: err,
        ...result,
      });

      // Update persistent run record with failure metrics
      if (this.dbClient) {
        try {
          await this.dbClient.db
            .update(schedulerJobRuns)
            .set({
              status: finalStatus,
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

          // Also record persistent failure log if this was an actual unexpected failure
          if (!wasCancelled) {
            await this.dbClient.recordFailure({
              executionId,
              jobName: job.name,
              severity: "error",
              errorCode: (err as any)?.code || (err as any)?.name || "JOB_FAILED",
              errorMessage,
              operation: "execute",
              stackTrace: err instanceof Error ? err.stack : undefined,
              retryable: false,
              metadata: result.details,
            });
          }
        } catch (dbErr) {
          jobLogger.debug("[JobRunner] Could not record job failure to database", { error: dbErr });
        }
      }

      return null;
    } finally {
      this.activeExecutions.delete(executionId);
      this.inFlightExecutions = Math.max(0, this.inFlightExecutions - 1);
      try {
        await lock.release();
      } catch (unlockErr) {
        jobLogger.warn(`[JobRunner] Error releasing lock for "${job.name}"`, { error: unlockErr });
      }
    }
  }
}
