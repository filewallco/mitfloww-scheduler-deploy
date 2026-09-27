import type { JobRegistry } from "./job-registry.js";
import type { JobRunner } from "./job-runner.js";
import { logger } from "../utils/logger.js";
import { env } from "../config/env.js";

interface JobScheduleState {
  nextRunTime: number;
}

export class SchedulerService {
  private intervalTimer: NodeJS.Timeout | null = null;
  private isRunning = false;
  private isPaused = false;
  private isShuttingDown = false;
  private scheduleMap = new Map<string, JobScheduleState>();

  constructor(
    private registry: JobRegistry,
    private runner: JobRunner
  ) {}

  start(): void {
    if (this.isRunning) {
      logger.warn("[Scheduler] Scheduler is already running.");
      return;
    }

    if (!env.SCHEDULER_ENABLED) {
      logger.warn("[Scheduler] SCHEDULER_ENABLED is false. Scheduler loop will not start.");
      return;
    }

    this.isRunning = true;
    this.isPaused = false;
    this.isShuttingDown = false;

    const now = Date.now();
    for (const job of this.registry.getEnabled()) {
      const delay = job.initialDelayMs ?? 0;
      this.scheduleMap.set(job.name, {
        nextRunTime: now + delay,
      });
    }

    logger.info(
      `[Scheduler] Started master scheduler loop (tick interval: ${env.SCHEDULER_TICK_INTERVAL_MS}ms, registered jobs: ${this.registry.getAll().length})`
    );

    this.intervalTimer = setInterval(() => {
      void this.tick();
    }, env.SCHEDULER_TICK_INTERVAL_MS);

    // Run first tick immediately
    void this.tick();
  }

  /**
   * Pauses the scheduler loop from initiating new scheduled ticks.
   * Already running executions continue to run safely until completion.
   */
  pause(actor = "admin"): { success: boolean; wasPaused: boolean } {
    if (this.isPaused) {
      return { success: true, wasPaused: true };
    }

    this.isPaused = true;
    logger.warn(`[Scheduler] Scheduler paused by ${actor}. New scheduled runs are suspended.`);
    return { success: true, wasPaused: false };
  }

  /**
   * Resumes the scheduler loop.
   */
  resume(actor = "admin"): { success: boolean; wasPaused: boolean } {
    if (!this.isPaused) {
      return { success: true, wasPaused: false };
    }

    this.isPaused = false;
    logger.info(`[Scheduler] Scheduler resumed by ${actor}. Scheduled runs will resume on next tick.`);
    return { success: true, wasPaused: true };
  }

  async tick(): Promise<void> {
    if (!this.isRunning || this.isShuttingDown) return;

    if (this.isPaused) {
      logger.debug("[Scheduler] Scheduler is paused. Skipping scheduled tick.");
      return;
    }

    const now = Date.now();
    const enabledJobs = this.registry.getEnabled();

    for (const job of enabledJobs) {
      const state = this.scheduleMap.get(job.name);
      if (!state) continue;

      if (now >= state.nextRunTime) {
        // Reschedule next run time first
        state.nextRunTime = now + job.intervalMs;

        // Fire-and-forget job execution with runner-level error isolation & concurrency control
        void this.runner.runJob(job, "scheduler").catch((err) => {
          logger.error(`[Scheduler] Uncaught error running job ${job.name}`, { error: err });
        });
      }
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      isShuttingDown: this.isShuttingDown,
      tickIntervalMs: env.SCHEDULER_TICK_INTERVAL_MS,
      registeredJobsCount: this.registry.getAll().length,
      enabledJobsCount: this.registry.getEnabled().length,
    };
  }

  async stop(): Promise<void> {
    if (!this.isRunning) return;

    logger.info("[Scheduler] Gracefully stopping scheduler service...");
    this.isShuttingDown = true;
    this.isRunning = false;
    this.isPaused = false;

    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }

    await this.runner.stopAll();
    logger.info("[Scheduler] Scheduler loop and active jobs stopped.");
  }
}
