import type { SchedulerJob } from "./job.interface.js";
import { logger } from "../utils/logger.js";

export class JobRegistry {
  private jobs = new Map<string, SchedulerJob>();

  register(job: SchedulerJob): this {
    if (this.jobs.has(job.name)) {
      throw new Error(`Job "${job.name}" is already registered.`);
    }
    this.jobs.set(job.name, job);
    logger.debug(`[JobRegistry] Registered job: ${job.name}`, {
      intervalMs: job.intervalMs,
      enabled: job.enabled ?? true,
    });
    return this;
  }

  get(name: string): SchedulerJob | undefined {
    return this.jobs.get(name);
  }

  getAll(): SchedulerJob[] {
    return Array.from(this.jobs.values());
  }

  getEnabled(): SchedulerJob[] {
    return this.getAll().filter((job) => job.enabled !== false);
  }
}
