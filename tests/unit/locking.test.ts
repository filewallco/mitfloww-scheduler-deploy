import { describe, it, expect, vi } from "vitest";
import { hashLockKeyToBigInt, PostgresAdvisoryLockProvider } from "../../src/core/locking/postgres-advisory-lock.js";

describe("PostgreSQL Advisory Lock hashing and mechanics", () => {
  it("produces deterministic 64-bit bigint string for a key", () => {
    const h1 = hashLockKeyToBigInt("scheduler:lock:expired-projects");
    const h2 = hashLockKeyToBigInt("scheduler:lock:expired-projects");
    expect(h1).toBe(h2);
    expect(typeof h1).toBe("string");
    expect(BigInt(h1) > 0n).toBe(true);
  });

  it("produces different hashes for different keys", () => {
    const h1 = hashLockKeyToBigInt("scheduler:lock:job-a");
    const h2 = hashLockKeyToBigInt("scheduler:lock:job-b");
    expect(h1).not.toBe(h2);
  });

  it("fits comfortably within signed 64-bit bigint range", () => {
    const hash = hashLockKeyToBigInt("very-long-job-name-with-special-characters-12345");
    const num = BigInt(hash);
    const maxSigned64 = BigInt("9223372036854775807");
    expect(num < maxSigned64).toBe(true);
    expect(num >= 0n).toBe(true);
  });

  it("fails to acquire lock if another instance holds it (mutual exclusion)", async () => {
    const mockClient = {
      query: vi.fn()
        .mockResolvedValueOnce({}) // SET statement_timeout
        .mockResolvedValueOnce({ rows: [{ pg_try_advisory_lock: false }] }), // Lock already held!
      release: vi.fn(),
    };

    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
    } as any;

    const provider = new PostgresAdvisoryLockProvider(mockPool);
    const lock = await provider.acquire("scheduler:lock:expired-projects");

    expect(lock).toBeNull();
    expect(mockClient.release).toHaveBeenCalled();
  });

  it("successfully acquires and releases lock", async () => {
    const mockClient = {
      query: vi.fn()
        .mockResolvedValueOnce({}) // SET statement_timeout
        .mockResolvedValueOnce({ rows: [{ pg_try_advisory_lock: true }] }) // Acquired!
        .mockResolvedValueOnce({}) // Reset statement timeout
        .mockResolvedValueOnce({}), // pg_advisory_unlock
      release: vi.fn(),
    };

    const mockPool = {
      connect: vi.fn().mockResolvedValue(mockClient),
    } as any;

    const provider = new PostgresAdvisoryLockProvider(mockPool);
    const lock = await provider.acquire("scheduler:lock:expired-projects");

    expect(lock).not.toBeNull();
    expect(lock?.key).toBe("scheduler:lock:expired-projects");

    await lock?.release();
    expect(mockClient.release).toHaveBeenCalled();
  });
});
