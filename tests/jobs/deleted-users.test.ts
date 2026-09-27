import { describe, it, expect, vi } from "vitest";
import { DeletedUsersService } from "../../src/jobs/deleted-users/deleted-users.service.js";
import { Logger } from "../../src/utils/logger.js";
import type { JobContext } from "../../src/core/job.interface.js";

describe("DeletedUsersService", () => {
  it("Case 1: within 30 days retention, cleans expired projects but retains user account", async () => {
    const mockUser = [
      {
        id: "user-recent-delete",
        email: "user@test.com",
        avatarStorageKey: null,
        deletedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago (< 30 days)
        status: 2,
      },
    ];

    const mockDb = {
      select: vi.fn()
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => Promise.resolve(mockUser),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: () => Promise.resolve([
              {
                id: "proj-expired-1",
                shareExpiresAt: new Date(Date.now() - 1000),
                deletedAt: null,
              },
            ]),
          }),
        }),
      delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue({}) }),
    };

    const mockDbClient = { db: mockDb } as any;
    const mockR2Cleaner = {
      deleteObjects: vi.fn().mockResolvedValue({ deletedCount: 0, failedCount: 0, errors: [] }),
      deletePrefix: vi.fn().mockResolvedValue({ deletedCount: 5, failedCount: 0, errors: [] }),
    } as any;

    const service = new DeletedUsersService(mockDbClient, mockR2Cleaner);

    const ctx: JobContext = {
      executionId: "exec-case1",
      jobName: "deleted-users",
      dryRun: false,
      logger: new Logger("error"),
      startedAt: new Date(),
      signal: new AbortController().signal,
    };

    const result = await service.processDeletedUsers(ctx);
    expect(result.scanned).toBe(1);
    expect(result.eligible).toBe(1);
    expect(result.processed).toBe(1);
    expect(mockDb.delete).not.toHaveBeenCalled();
    expect(mockR2Cleaner.deletePrefix).toHaveBeenCalledWith(
      "users/user-recent-delete/projects/proj-expired-1/",
      expect.any(String),
      false
    );
  });

  it("Case 2: past 30 days retention, performs complete purge of user R2 prefix and DB records", async () => {
    const mockUser = [
      {
        id: "user-old-delete",
        email: "old@test.com",
        avatarStorageKey: "users/user-old-delete/userprofile/avatar.png",
        deletedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), // 35 days ago (> 30 days)
        status: 2,
      },
    ];

    const mockDb = {
      select: vi.fn()
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => Promise.resolve(mockUser),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => Promise.resolve([]), // userProjects
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => Promise.resolve([]), // userAssets
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: () => ({
            where: () => Promise.resolve([]), // companies
          }),
        }),
      delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue({}) }),
    };

    const mockDbClient = { db: mockDb } as any;
    const mockR2Cleaner = {
      deleteObjects: vi.fn().mockResolvedValue({ deletedCount: 1, failedCount: 0, errors: [] }),
      deletePrefix: vi.fn().mockResolvedValue({ deletedCount: 10, failedCount: 0, errors: [] }),
    } as any;

    const service = new DeletedUsersService(mockDbClient, mockR2Cleaner);

    const ctx: JobContext = {
      executionId: "exec-case2",
      jobName: "deleted-users",
      dryRun: false,
      logger: new Logger("error"),
      startedAt: new Date(),
      signal: new AbortController().signal,
    };

    const result = await service.processDeletedUsers(ctx);
    expect(result.scanned).toBe(1);
    expect(result.eligible).toBe(1);
    expect(result.processed).toBe(1);
    expect(mockR2Cleaner.deletePrefix).toHaveBeenCalledWith(
      "users/user-old-delete/",
      expect.any(String),
      false
    );
    expect(mockDb.delete).toHaveBeenCalled();
  });
});
