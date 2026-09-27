import { describe, it, expect, vi } from "vitest";
import { OrphanedProcessedFilesService } from "../../src/jobs/orphaned-processed-files/orphaned-processed-files.service.js";
import { Logger } from "../../src/utils/logger.js";
import type { JobContext } from "../../src/core/job.interface.js";

describe("OrphanedProcessedFilesService", () => {
  it("deletes failed processed artifacts and updates file_versions record", async () => {
    const mockVersions = [
      {
        id: "ver-failed-1",
        processedStorageKey: "users/u1/projects/p1/files/f1/revisions/r001/processed/video.mp4",
        processingStatus: 5, // Failed
        updatedAt: new Date(Date.now() - 72 * 60 * 60 * 1000), // 72h ago
      },
    ];

    const mockDb = {
      select: vi.fn()
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => Promise.resolve(mockVersions),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              limit: () => Promise.resolve([]), // No active version using this key
            }),
          }),
        }),
      update: vi.fn().mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: "ver-failed-1" }]),
          }),
        }),
      }),
    };

    const mockR2Cleaner = {
      deleteObjects: vi.fn().mockResolvedValue({ deletedCount: 1, failedCount: 0, errors: [] }),
    } as any;

    const service = new OrphanedProcessedFilesService({ db: mockDb } as any, mockR2Cleaner);

    const ctx: JobContext = {
      executionId: "exec-orphaned",
      jobName: "orphaned-processed-files",
      dryRun: false,
      logger: new Logger("error"),
      startedAt: new Date(),
      signal: new AbortController().signal,
    };

    const result = await service.processOrphanedFiles(ctx);
    expect(result.scanned).toBe(1);
    expect(result.eligible).toBe(1);
    expect(result.deleted).toBe(1);
    expect(result.processed).toBe(1);
    expect(mockR2Cleaner.deleteObjects).toHaveBeenCalledWith(
      ["users/u1/projects/p1/files/f1/revisions/r001/processed/video.mp4"],
      expect.any(String),
      false,
      expect.anything()
    );
  });
});
