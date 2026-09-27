import type { JobContext, JobResult, SchedulerJob } from "../../core/job.interface.js";
import { JOB_INTERVALS } from "../../config/constants.js";
import type { OrphanedProcessedFilesService } from "./orphaned-processed-files.service.js";

export class OrphanedProcessedFilesJob implements SchedulerJob {
  readonly name = "orphaned-processed-files";
  readonly description = "Identifies and cleans up abandoned worker processing artifacts exceeding retention";
  readonly intervalMs = JOB_INTERVALS.ORPHANED_FILES;
  readonly initialDelayMs = 45000; // 45s initial delay

  constructor(private service: OrphanedProcessedFilesService) {}

  async execute(ctx: JobContext): Promise<JobResult> {
    return await this.service.processOrphanedFiles(ctx);
  }
}
