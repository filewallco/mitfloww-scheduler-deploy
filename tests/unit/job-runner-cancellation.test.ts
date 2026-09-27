import { describe, it, expect, vi } from "vitest";
import { JobRunner } from "../../src/core/job-runner.js";
import type { SchedulerJob } from "../../src/core/job.interface.js";
import { SchedulerJobStatus } from "../../src/types/schema-enums.js";

describe("JobRunner cooperative cancellation & failure logging", () => {
  it("cooperatively cancels an active running job and releases lock", async () => {
    const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue({}) });
    const mockUpdate = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue({}) }) });
    const mockRecordAudit = vi.fn().mockResolvedValue(undefined);
    const mockRecordFailure = vi.fn().mockResolvedValue(undefined);

    const mockDbClient = {
      db: {
        insert: mockInsert,
        update: mockUpdate,
      },
      recordAdminAudit: mockRecordAudit,
      recordFailure: mockRecordFailure,
    } as any;

    const mockLock = {
      key: "lock:test-cancel",
      acquiredAt: new Date(),
      release: vi.fn().mockResolvedValue(undefined),
    };

    const mockLockProvider = {
      acquire: vi.fn().mockResolvedValue(mockLock),
    };

    const runner = new JobRunner(mockLockProvider, mockDbClient);

    let abortObserved = false;
    const longRunningJob: SchedulerJob = {
      name: "long-job",
      description: "A job that checks abort signal",
      intervalMs: 5000,
      execute: async (ctx) => {
        return new Promise((resolve) => {
          ctx.signal.addEventListener("abort", () => {
            abortObserved = true;
            resolve({
              scanned: 10,
              eligible: 5,
              processed: 2,
              deleted: 2,
              skipped: 0,
              failed: 0,
            });
          });
        });
      },
    };

    // Start job in background
    const jobPromise = runner.runJob(longRunningJob);

    // Yield to allow async lock acquisition and job start
    await new Promise((r) => setTimeout(r, 10));

    // Verify active execution is registered
    const active = runner.getActiveExecutions();
    expect(active.length).toBe(1);
    expect(active[0]?.jobName).toBe("long-job");

    // Cancel execution
    const cancelRes = await runner.cancelExecution("long-job", "test-admin");
    expect(cancelRes.cancelled).toBe(true);

    // Wait for job completion
    const result = await jobPromise;
    expect(result).toBeDefined();
    expect(abortObserved).toBe(true);

    // Verify lock released
    expect(mockLock.release).toHaveBeenCalled();

    // Verify status updated to cancelled
    const status = runner.getStatus("long-job");
    expect(status.lastStatus).toBe(SchedulerJobStatus.Cancelled);
    expect(runner.getActiveExecutions().length).toBe(0);
    expect(mockRecordAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "cancel_job", jobName: "long-job", result: "cancelled" })
    );
  });

  it("persists structured failure logs to database on unexpected job error", async () => {
    const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue({}) });
    const mockUpdate = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue({}) }) });
    const mockRecordFailure = vi.fn().mockResolvedValue(undefined);

    const mockDbClient = {
      db: {
        insert: mockInsert,
        update: mockUpdate,
      },
      recordFailure: mockRecordFailure,
    } as any;

    const mockLock = {
      key: "lock:test-fail",
      acquiredAt: new Date(),
      release: vi.fn().mockResolvedValue(undefined),
    };

    const mockLockProvider = {
      acquire: vi.fn().mockResolvedValue(mockLock),
    };

    const runner = new JobRunner(mockLockProvider, mockDbClient);

    const failingJob: SchedulerJob = {
      name: "failing-job",
      description: "A job that throws an error",
      intervalMs: 5000,
      execute: async () => {
        throw new Error("Neon database connection timed out during batch cleanup");
      },
    };

    const result = await runner.runJob(failingJob);
    expect(result).toBeNull();

    const status = runner.getStatus("failing-job");
    expect(status.lastStatus).toBe(SchedulerJobStatus.Failed);
    expect(status.consecutiveFailures).toBe(1);
    expect(mockLock.release).toHaveBeenCalled();

    expect(mockRecordFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        jobName: "failing-job",
        severity: "error",
        errorMessage: expect.stringContaining("Neon database connection timed out"),
      })
    );
  });
});
