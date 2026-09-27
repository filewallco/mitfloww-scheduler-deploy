import type { JobContext, JobResult, SchedulerJob } from "../../core/job.interface.js";
import { JOB_INTERVALS } from "../../config/constants.js";
import type { RevisionLifecycleService } from "./revision-lifecycle.service.js";

export class RevisionLifecycleJob implements SchedulerJob {
  readonly name = "revision-lifecycle";
  readonly description = "Cleans up expired revision previews and old resolved file reports";
  readonly intervalMs = JOB_INTERVALS.REVISION_LIFECYCLE;
  readonly initialDelayMs = 20000; // 20s initial delay

  constructor(private service: RevisionLifecycleService) {}

  async execute(ctx: JobContext): Promise<JobResult> {
    return await this.service.processRevisionLifecycle(ctx);
  }
}
