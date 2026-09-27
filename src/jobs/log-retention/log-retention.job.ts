import type { JobContext, JobResult, SchedulerJob } from "../../core/job.interface.js";
import { JOB_INTERVALS } from "../../config/constants.js";
import type { LogRetentionService } from "./log-retention.service.js";

export class LogRetentionJob implements SchedulerJob {
  readonly name = "log-retention";
  readonly description = "Purges expired operational logs from api_logs, web_logs, worker_logs, and scheduler_logs";
  // Run every 12 hours (or fallback to 12h in ms)
  readonly intervalMs = (JOB_INTERVALS as any).LOG_RETENTION || 12 * 60 * 60 * 1000;
  readonly initialDelayMs = 120000; // 2 min initial delay

  constructor(private service: LogRetentionService) {}

  async execute(ctx: JobContext): Promise<JobResult> {
    return await this.service.purgeExpiredLogs(ctx);
  }
}
