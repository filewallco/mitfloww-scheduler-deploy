import { describe, it, expect, vi } from "vitest";
import { ExpiredProjectsService } from "../../src/jobs/expired-projects/expired-projects.service.js";
import { Logger } from "../../src/utils/logger.js";
import type { JobContext } from "../../src/core/job.interface.js";

describe("ExpiredProjectsService", () => {
  it("skips project if active file upload is currently in progress", async () => {
    const mockCandidate = [
      {
        id: "proj-1",
        userId: "user-1",
        title: "Test Project",
        shareExpiresAt: new Date(Date.now() - 10000),
        deletedAt: null,
      },
    ];

    const mockDb = {
      select: vi.fn()
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => Promise.resolve(mockCandidate),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([{ id: "file-uploading-1" }]),
            }),
          }),
        }),
    };

    const mockDbClient = { db: mockDb } as any;
    const mockR2Cleaner = {
      deleteObjects: vi.fn().mockResolvedValue({ deletedCount: 0, failedCount: 0, errors: [] }),
      deletePrefix: vi.fn().mockResolvedValue({ deletedCount: 0, failedCount: 0, errors: [] }),
    } as any;

    const service = new ExpiredProjectsService(mockDbClient, mockR2Cleaner);

    const ctx: JobContext = {
      executionId: "exec-1",
      jobName: "expired-projects",
      dryRun: false,
      logger: new Logger("error"),
      startedAt: new Date(),
      signal: new AbortController().signal,
    };

    const result = await service.processExpiredProjects(ctx);
    expect(result.scanned).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.eligible).toBe(0);
    expect(mockR2Cleaner.deleteObjects).not.toHaveBeenCalled();
  });
});
