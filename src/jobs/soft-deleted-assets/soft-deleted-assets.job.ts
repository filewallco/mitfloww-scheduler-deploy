import type { JobContext, JobResult, SchedulerJob } from "../../core/job.interface.js";
import { JOB_INTERVALS } from "../../config/constants.js";
import type { SoftDeletedAssetsService } from "./soft-deleted-assets.service.js";

export class SoftDeletedAssetsJob implements SchedulerJob {
  readonly name = "soft-deleted-assets";
  readonly description = "Permanently deletes R2 objects and DB records for soft-deleted assets past retention";
  readonly intervalMs = JOB_INTERVALS.SOFT_DELETED_ASSETS;
  readonly initialDelayMs = 60000; // 60s initial delay

  constructor(private service: SoftDeletedAssetsService) {}

  async execute(ctx: JobContext): Promise<JobResult> {
    return await this.service.processSoftDeletedAssets(ctx);
  }
}
