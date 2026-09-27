import type { Logger } from "../utils/logger.js";
import type { SchedulerJobStatus } from "../types/schema-enums.js";

export interface JobResult {
  scanned: number;
  eligible: number;
  processed: number;
  deleted: number;
  skipped: number;
  failed: number;
  details?: Record<string, unknown>;
}

export interface JobContext {
  executionId: string;
  jobName: string;
  dryRun: boolean;
  logger: Logger;
  startedAt: Date;
  signal: AbortSignal;
}

export interface SchedulerJob {
  readonly name: string;
  readonly description: string;
  readonly intervalMs: number;
  readonly initialDelayMs?: number;
  readonly enabled?: boolean;

  execute(ctx: JobContext): Promise<JobResult>;
}

export interface JobExecutionStatus {
  name: string;
  lastRunAt: Date | null;
  lastCompletedAt: Date | null;
  lastDurationMs: number | null;
  lastStatus: SchedulerJobStatus;
  lastError: string | null;
  lastResult: JobResult | null;
  consecutiveFailures: number;
}
