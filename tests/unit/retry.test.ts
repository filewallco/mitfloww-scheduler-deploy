import { describe, it, expect } from "vitest";
import { withRetry } from "../../src/core/retry/retry-helper.js";

describe("withRetry helper", () => {
  it("succeeds on first attempt without delay", async () => {
    let attempts = 0;
    const result = await withRetry(async (att) => {
      attempts = att;
      return "success";
    });
    expect(result).toBe("success");
    expect(attempts).toBe(1);
  });

  it("retries on transient failure and returns success", async () => {
    let attempts = 0;
    const result = await withRetry(
      async (att) => {
        attempts = att;
        if (att === 1) throw new Error("Transient network error");
        return "recovered";
      },
      { maxRetries: 2, initialBackoffMs: 10, maxBackoffMs: 50 }
    );
    expect(result).toBe("recovered");
    expect(attempts).toBe(2);
  });

  it("throws after exhausting max retries", async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async (att) => {
          attempts = att;
          throw new Error("Persistent failure");
        },
        { maxRetries: 2, initialBackoffMs: 10, maxBackoffMs: 50 }
      )
    ).rejects.toThrow("Persistent failure");
    expect(attempts).toBe(3);
  });

  it("stops immediately on non-retryable error", async () => {
    let attempts = 0;
    await expect(
      withRetry(
        async (att) => {
          attempts = att;
          throw new Error("FATAL_PERM");
        },
        {
          maxRetries: 3,
          initialBackoffMs: 10,
          shouldRetry: (err) => !(err instanceof Error && err.message === "FATAL_PERM"),
        }
      )
    ).rejects.toThrow("FATAL_PERM");
    expect(attempts).toBe(1);
  });
});
