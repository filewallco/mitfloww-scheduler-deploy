import type { JobContext, JobResult, SchedulerJob } from "../../core/job.interface.js";
import { JOB_INTERVALS } from "../../config/constants.js";
import type { DeletedUsersService } from "./deleted-users.service.js";

export class DeletedUsersJob implements SchedulerJob {
  readonly name = "deleted-users";
  readonly description = "Handles cleanup of deleted user accounts: project expiry before retention and full purge after 30 days";
  readonly intervalMs = JOB_INTERVALS.DELETED_USERS;
  readonly initialDelayMs = 90000; // 90s initial delay

  constructor(private service: DeletedUsersService) {}

  async execute(ctx: JobContext): Promise<JobResult> {
    return await this.service.processDeletedUsers(ctx);
  }
}
