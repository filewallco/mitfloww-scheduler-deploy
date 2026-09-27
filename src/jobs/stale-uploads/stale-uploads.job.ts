import type { JobContext, JobResult, SchedulerJob } from "../../core/job.interface.js";
import { JOB_INTERVALS } from "../../config/constants.js";
import type { StaleUploadsService } from "./stale-uploads.service.js";

export class StaleUploadsJob implements SchedulerJob {
  readonly name = "stale-uploads";
  readonly description = "Detects and aborts abandoned multipart uploads and cleans up stale incomplete uploads";
  readonly intervalMs = JOB_INTERVALS.STALE_UPLOADS;
  readonly initialDelayMs = 30000; // 30s initial delay

  constructor(private service: StaleUploadsService) {}

  async execute(ctx: JobContext): Promise<JobResult> {
    return await this.service.processStaleUploads(ctx);
  }
}
