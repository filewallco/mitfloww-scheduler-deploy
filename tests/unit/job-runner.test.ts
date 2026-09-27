import { describe, it, expect, vi } from "vitest";
import { JobRunner } from "../../src/core/job-runner.js";
import type { SchedulerJob } from "../../src/core/job.interface.js";

describe("JobRunner persistent execution tracking", () => {
  it("records running and success metrics in scheduler_job_runs", async () => {
    const mockInsert = vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue({}) });
    const mockUpdate = vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue({}) }) });

    const mockDbClient = {
      db: {
        insert: mockInsert,
        update: mockUpdate,
      },
    } as any;

    const mockLock = {
      key: "lock:test",
      acquiredAt: new Date(),
      release: vi.fn().mockResolvedValue(undefined),
    };

    const mockLockProvider = {
      acquire: vi.fn().mockResolvedValue(mockLock),
    };

    const runner = new JobRunner(mockLockProvider, mockDbClient);

    const testJob: SchedulerJob = {
      name: "test-history-job",
      description: "Test job for persistent audit history",
      intervalMs: 1000,
      execute: async () => ({
        scanned: 10,
        eligible: 5,
        processed: 5,
        deleted: 5,
        skipped: 5,
        failed: 0,
      }),
    };

    const result = await runner.runJob(testJob);

    expect(result).toBeDefined();
    expect(result?.deleted).toBe(5);
    expect(mockInsert).toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalled();
    expect(mockLock.release).toHaveBeenCalled();

    const status = runner.getStatus("test-history-job");
    expect(status.lastStatus).toBe("success");
    expect(status.lastResult?.deleted).toBe(5);
  });
});
