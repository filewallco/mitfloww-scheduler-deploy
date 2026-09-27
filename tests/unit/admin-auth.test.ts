import { describe, it, expect, beforeEach } from "vitest";
import { authenticateLogin, verifyAuth, parseCookies, checkRateLimit } from "../../src/api/auth.js";
import { env } from "../../src/config/env.js";

describe("Admin API Authentication & Security", () => {
  beforeEach(() => {
    // default admin key
    (env as any).SCHEDULER_ADMIN_KEY = "test-secret-key-12345";
  });

  it("authenticates valid Bearer token", () => {
    const req = {
      headers: {
        authorization: "Bearer test-secret-key-12345",
      },
      socket: { remoteAddress: "127.0.0.1" },
    } as any;

    const result = verifyAuth(req);
    expect(result.authenticated).toBe(true);
    expect(result.actor).toContain("bearer:127.0.0.1");
  });

  it("authenticates valid x-scheduler-key header", () => {
    const req = {
      headers: {
        "x-scheduler-key": "test-secret-key-12345",
      },
      socket: { remoteAddress: "127.0.0.1" },
    } as any;

    const result = verifyAuth(req);
    expect(result.authenticated).toBe(true);
    expect(result.actor).toContain("apikey:127.0.0.1");
  });

  it("authenticates valid cookie token", () => {
    const req = {
      headers: {
        cookie: "scheduler_admin_token=test-secret-key-12345; other=123",
      },
      socket: { remoteAddress: "127.0.0.1" },
    } as any;

    const result = verifyAuth(req);
    expect(result.authenticated).toBe(true);
    expect(result.actor).toContain("cookie:127.0.0.1");
  });

  it("rejects invalid tokens and credentials", () => {
    const req = {
      headers: {
        authorization: "Bearer wrong-token",
      },
      socket: { remoteAddress: "127.0.0.1" },
    } as any;

    const result = verifyAuth(req);
    expect(result.authenticated).toBe(false);
  });

  it("rejects missing authentication", () => {
    const req = {
      headers: {},
      socket: { remoteAddress: "127.0.0.1" },
    } as any;

    const result = verifyAuth(req);
    expect(result.authenticated).toBe(false);
  });

  it("authenticates login endpoint key correctly", () => {
    const req = { socket: { remoteAddress: "127.0.0.1" }, headers: {} } as any;
    const ok = authenticateLogin(req, "test-secret-key-12345");
    expect(ok.success).toBe(true);
    expect(ok.token).toBe("test-secret-key-12345");

    const fail = authenticateLogin(req, "bad-password");
    expect(fail.success).toBe(false);
    expect(fail.error).toBeDefined();
  });

  it("rate limits brute force attempts", () => {
    const map = new Map();
    const key = "test-ip";
    for (let i = 1; i <= 5; i++) {
      const res = checkRateLimit(map, key, 5, 10000);
      expect(res.allowed).toBe(true);
    }
    const exceeded = checkRateLimit(map, key, 5, 10000);
    expect(exceeded.allowed).toBe(false);
  });
});
