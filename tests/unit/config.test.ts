import { describe, it, expect } from "vitest";
import { loadEnv } from "../../src/config/env.js";

describe("Env config validation", () => {
  it("loads validated configuration successfully in test environment", () => {
    const config = loadEnv();
    expect(config).toBeDefined();
    expect(config.NODE_ENV).toBeDefined();
    expect(config.ACCOUNT_DELETION_RETENTION_DAYS).toBeGreaterThan(0);
    expect(config.STALE_UPLOAD_RETENTION_HOURS).toBeGreaterThan(0);
    expect(config.ORPHANED_FILE_RETENTION_HOURS).toBeGreaterThan(0);
    expect(config.SOFT_DELETED_ASSET_RETENTION_DAYS).toBeGreaterThan(0);
  });

  it("exposes default batch size and tick interval", () => {
    const config = loadEnv();
    expect(config.SCHEDULER_BATCH_SIZE).toBeGreaterThanOrEqual(1);
    expect(config.SCHEDULER_TICK_INTERVAL_MS).toBeGreaterThanOrEqual(1000);
    expect(config.SCHEDULER_ADMIN_KEY).toBeDefined();
    expect(typeof config.SCHEDULER_ADMIN_KEY).toBe("string");
  });
});
