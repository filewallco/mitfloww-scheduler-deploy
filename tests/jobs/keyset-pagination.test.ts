import { describe, it, expect, vi } from "vitest";
import { SoftDeletedAssetsService } from "../../src/jobs/soft-deleted-assets/soft-deleted-assets.service.js";
import { Logger } from "../../src/utils/logger.js";
import type { JobContext } from "../../src/core/job.interface.js";
import { env } from "../../src/config/env.js";

describe("Keyset Pagination in cleanup jobs", () => {
  it("traverses multiple pages via cursor without drift or skipped records", async () => {
    // Generate a batch of size env.SCHEDULER_BATCH_SIZE to trigger pagination to page 2
    const batchSize = env.SCHEDULER_BATCH_SIZE;
    const page1 = Array.from({ length: batchSize }, (_, i) => ({
      id: `asset-${String(i).padStart(3, "0")}`,
      userId: "u1",
      title: `Asset ${i}`,
      deletedAt: new Date(Date.now() - 30 * 86400000),
    }));

    const page2 = [
      {
        id: "asset-overflow-999",
        userId: "u1",
        title: "Asset Overflow",
        deletedAt: new Date(Date.now() - 30 * 86400000),
      },
    ];

    let queryCount = 0;
    const mockDb = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => {
            const limitFn = vi.fn().mockImplementation(() => {
              queryCount++;
              if (queryCount === 1) return Promise.resolve(page1);
              if (queryCount === 2) return Promise.resolve(page2);
              return Promise.resolve([]);
            });
            return {
              orderBy: vi.fn(() => ({ limit: limitFn })),
              then: (resolve) => resolve([]),
            };
          }),
        })),
      })),
      delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue({}) }),
    };

    const mockR2Cleaner = {
      deleteObjects: vi.fn().mockResolvedValue({ deletedCount: 0, failedCount: 0, errors: [] }),
    } as any;

    const service = new SoftDeletedAssetsService({ db: mockDb } as any, mockR2Cleaner);

    const ctx: JobContext = {
      executionId: "exec-pagination",
      jobName: "soft-deleted-assets",
      dryRun: false,
      logger: new Logger("error"),
      startedAt: new Date(),
      signal: new AbortController().signal,
    };

    const result = await service.processSoftDeletedAssets(ctx);
    // Page 1 (batchSize items) + Page 2 (1 item)
    expect(result.scanned).toBe(batchSize + 1);
    expect(result.eligible).toBe(batchSize + 1);
    expect(queryCount).toBe(2);
  });
});
