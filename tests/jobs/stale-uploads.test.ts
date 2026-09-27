import { describe, it, expect, vi } from "vitest";
import { StaleUploadsService } from "../../src/jobs/stale-uploads/stale-uploads.service.js";
import { Logger } from "../../src/utils/logger.js";
import type { JobContext } from "../../src/core/job.interface.js";

describe("StaleUploadsService", () => {
  it("aborts multipart uploads that exceed the retention grace period", async () => {
    const mockDb = {
      select: vi.fn().mockReturnValueOnce({
        from: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve([]),
            }),
          }),
        }),
      }),
      update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue({}) }) }),
    };

    const staleDate = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48h ago (> 24h)
    const freshDate = new Date(Date.now() - 1000); // 1s ago

    const mockR2Cleaner = {
      listMultipartUploads: vi.fn().mockResolvedValueOnce([
        { key: "users/u1/projects/p1/files/f1/file.mp4", uploadId: "up-stale", initiatedAt: staleDate },
        { key: "users/u1/projects/p1/files/f2/file.mp4", uploadId: "up-fresh", initiatedAt: freshDate },
      ]),
      abortMultipartUpload: vi.fn().mockResolvedValue(true),
      deleteObjects: vi.fn().mockResolvedValue({ deletedCount: 0, failedCount: 0, errors: [] }),
    } as any;

    const service = new StaleUploadsService({ db: mockDb } as any, mockR2Cleaner);

    const ctx: JobContext = {
      executionId: "exec-stale",
      jobName: "stale-uploads",
      dryRun: false,
      logger: new Logger("error"),
      startedAt: new Date(),
      signal: new AbortController().signal,
    };

    const result = await service.processStaleUploads(ctx);
    expect(result.scanned).toBe(2);
    expect(result.eligible).toBe(1);
    expect(result.skipped).toBe(1);
    expect(mockR2Cleaner.abortMultipartUpload).toHaveBeenCalledWith(
      "users/u1/projects/p1/files/f1/file.mp4",
      "up-stale",
      expect.any(String),
      false
    );
  });
});
