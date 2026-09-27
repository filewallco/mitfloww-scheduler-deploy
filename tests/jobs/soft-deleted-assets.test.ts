import { describe, it, expect, vi } from "vitest";
import { SoftDeletedAssetsService } from "../../src/jobs/soft-deleted-assets/soft-deleted-assets.service.js";
import { Logger } from "../../src/utils/logger.js";
import type { JobContext } from "../../src/core/job.interface.js";

describe("SoftDeletedAssetsService", () => {
  it("deletes R2 storage keys and removes database records for eligible soft-deleted assets", async () => {
    const mockAssets = [
      {
        id: "asset-1",
        userId: "user-1",
        title: "Soft Deleted Asset",
        deletedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      },
    ];

    const mockDb = {
      select: vi.fn()
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => Promise.resolve(mockAssets),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: () => Promise.resolve([{ storageKey: "users/u1/assets/a1/file1.png" }]),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: () => Promise.resolve([{ storageKey: "users/u1/assets/a1/preview1.jpg" }]),
          }),
        }),
      delete: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue({}),
      }),
    };

    const mockDbClient = { db: mockDb } as any;
    const mockR2Cleaner = {
      deleteObjects: vi.fn().mockResolvedValue({ deletedCount: 2, failedCount: 0, errors: [] }),
    } as any;

    const service = new SoftDeletedAssetsService(mockDbClient, mockR2Cleaner);

    const ctx: JobContext = {
      executionId: "exec-assets",
      jobName: "soft-deleted-assets",
      dryRun: false,
      logger: new Logger("error"),
      startedAt: new Date(),
      signal: new AbortController().signal,
    };

    const result = await service.processSoftDeletedAssets(ctx);
    expect(result.scanned).toBe(1);
    expect(result.eligible).toBe(1);
    expect(result.deleted).toBe(2);
    expect(result.processed).toBe(1);
    expect(mockR2Cleaner.deleteObjects).toHaveBeenCalledWith(
      ["users/u1/assets/a1/file1.png", "users/u1/assets/a1/preview1.jpg"],
      expect.any(String),
      false
    );
  });
});
