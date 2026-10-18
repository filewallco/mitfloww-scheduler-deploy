import type { JobContext, JobResult, SchedulerJob } from "../../core/job.interface.js";
import { JOB_INTERVALS } from "../../config/constants.js";
import type { PlanExpiryService } from "./plan-expiry.service.js";

export class PlanExpiryJob implements SchedulerJob {
  readonly name = "plan-expiry";
  readonly description = "Monitors paid user subscriptions, dispatches lifecycle emails (3 days before, on expiry, and post-expiry) and downgrades expired accounts to Free";
  readonly intervalMs = JOB_INTERVALS.PLAN_EXPIRY;
  readonly initialDelayMs = 10000; // 10s initial delay after startup

  constructor(private service: PlanExpiryService) {}

  async execute(ctx: JobContext): Promise<JobResult> {
    return await this.service.processPlanExpirations(ctx);
  }
}

