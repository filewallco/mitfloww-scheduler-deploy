import type { JobContext, JobResult, SchedulerJob } from "../../core/job.interface.js";
import { JOB_INTERVALS } from "../../config/constants.js";
import type { ExpiredProjectsService } from "./expired-projects.service.js";

export class ExpiredProjectsJob implements SchedulerJob {
  readonly name = "expired-projects";
  readonly description = "Cleans up R2 storage files and revisions for expired paid projects";
  readonly intervalMs = JOB_INTERVALS.EXPIRED_PROJECTS;
  readonly initialDelayMs = 5000; // 5s initial delay after startup

  constructor(private service: ExpiredProjectsService) {}

  async execute(ctx: JobContext): Promise<JobResult> {
    return await this.service.processExpiredProjects(ctx);
  }
}
