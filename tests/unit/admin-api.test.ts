import { describe, it, expect, vi, beforeEach } from "vitest";
import { URL } from "node:url";
import { ApiRouter } from "../../src/api/router.js";
import { JobRegistry } from "../../src/core/job-registry.js";
import { SchedulerService } from "../../src/core/scheduler.js";
import { env } from "../../src/config/env.js";

function createMockResponse() {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: "",
    writeHead: vi.fn((code: number, headers: Record<string, string>) => {
      res.statusCode = code;
      res.headers = headers;
    }),
    end: vi.fn((chunk: string) => {
      res.body = chunk;
    }),
  };
  return res;
}

describe("Scheduler Admin API Router", () => {
  let mockDbClient: any;
  let mockRunner: any;
  let mockScheduler: any;
  let registry: JobRegistry;
  let router: ApiRouter;

  beforeEach(() => {
    (env as any).SCHEDULER_ADMIN_KEY = "test-secret-key-12345";
    (env as any).DRY_RUN = true;

    mockDbClient = {
      healthCheck: vi.fn().mockResolvedValue(true),
      recordAdminAudit: vi.fn().mockResolvedValue(undefined),
      recordFailure: vi.fn().mockResolvedValue(undefined),
      getJobRuns: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      getFailureLogs: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      getAdminAuditLogs: vi.fn().mockResolvedValue({ items: [], total: 0 }),
      getAdminAuditLogById: vi.fn().mockImplementation((id) => Promise.resolve(id === "audit-123" ? { id: "audit-123", action: "run_job", actor: "admin" } : null)),
      clearHistory: vi.fn().mockResolvedValue({ deletedRuns: 10, deletedFailures: 2, deletedAudits: 0 }),
      getOverallMetrics: vi.fn().mockResolvedValue({ summary: {}, failures: {} }),
    };

    mockRunner = {
      getStatus: vi.fn().mockReturnValue({ lastStatus: "idle", consecutiveFailures: 0 }),
      getAllStatuses: vi.fn().mockReturnValue({}),
      getActiveExecutions: vi.fn().mockReturnValue([]),
      runJob: vi.fn().mockResolvedValue({ deleted: 3 }),
      cancelExecution: vi.fn().mockResolvedValue({ cancelled: true, message: "Cancelled" }),
      resetConsecutiveFailures: vi.fn(),
    };

    registry = new JobRegistry();
    registry.register({
      name: "test-cleanup-job",
      description: "Test cleanup description",
      intervalMs: 10000,
      execute: async () => ({ scanned: 0, eligible: 0, processed: 0, deleted: 0, skipped: 0, failed: 0 }),
    });

    mockScheduler = new SchedulerService(registry, mockRunner);

    router = new ApiRouter({
      dbClient: mockDbClient,
      runner: mockRunner,
      scheduler: mockScheduler,
      registry,
      startedAt: new Date(),
    });
  });

  it("handles unauthenticated health check endpoints without credentials", async () => {
    const req = { method: "GET", headers: {}, socket: { remoteAddress: "127.0.0.1" } } as any;
    const res = createMockResponse();

    const handled = await router.handleRequest(req, res as any, "/health", new URL("http://localhost/health"));
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe("healthy");
  });

  it("rejects protected endpoints when unauthenticated", async () => {
    const req = { method: "GET", headers: {}, socket: { remoteAddress: "127.0.0.1" } } as any;
    const res = createMockResponse();

    const handled = await router.handleRequest(req, res as any, "/api/jobs", new URL("http://localhost/api/jobs"));
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(401);
  });

  it("returns jobs listing for authenticated requests", async () => {
    const req = {
      method: "GET",
      headers: { authorization: "Bearer test-secret-key-12345" },
      socket: { remoteAddress: "127.0.0.1" },
    } as any;
    const res = createMockResponse();

    const handled = await router.handleRequest(req, res as any, "/api/jobs", new URL("http://localhost/api/jobs"));
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.jobs.length).toBe(1);
    expect(body.jobs[0].name).toBe("test-cleanup-job");
  });

  it("manually triggers a registered job via Run Now and records audit", async () => {
    const req = {
      method: "POST",
      headers: { authorization: "Bearer test-secret-key-12345" },
      socket: { remoteAddress: "127.0.0.1" },
    } as any;
    const res = createMockResponse();

    const handled = await router.handleRequest(
      req,
      res as any,
      "/api/jobs/test-cleanup-job/run",
      new URL("http://localhost/api/jobs/test-cleanup-job/run")
    );
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(202);
    expect(mockRunner.runJob).toHaveBeenCalled();
    expect(mockDbClient.recordAdminAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: "run_job", jobName: "test-cleanup-job", result: "success" })
    );
  });

  it("returns 404 when triggering an invalid job name", async () => {
    const req = {
      method: "POST",
      headers: { authorization: "Bearer test-secret-key-12345" },
      socket: { remoteAddress: "127.0.0.1" },
    } as any;
    const res = createMockResponse();

    const handled = await router.handleRequest(
      req,
      res as any,
      "/api/jobs/unknown-job/run",
      new URL("http://localhost/api/jobs/unknown-job/run")
    );
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(404);
  });

  it("pauses and resumes scheduler via API", async () => {
    const pauseReq = {
      method: "POST",
      headers: { authorization: "Bearer test-secret-key-12345" },
      socket: { remoteAddress: "127.0.0.1" },
    } as any;
    const pauseRes = createMockResponse();

    await router.handleRequest(pauseReq, pauseRes as any, "/api/scheduler/pause", new URL("http://localhost/api/scheduler/pause"));
    expect(pauseRes.statusCode).toBe(200);
    expect(mockScheduler.getStatus().isPaused).toBe(true);

    const resumeReq = {
      method: "POST",
      headers: { authorization: "Bearer test-secret-key-12345" },
      socket: { remoteAddress: "127.0.0.1" },
    } as any;
    const resumeRes = createMockResponse();

    await router.handleRequest(resumeReq, resumeRes as any, "/api/scheduler/resume", new URL("http://localhost/api/scheduler/resume"));
    expect(resumeRes.statusCode).toBe(200);
    expect(mockScheduler.getStatus().isPaused).toBe(false);
  });

  it("serves SVG logo asset without authentication", async () => {
    const req = { method: "GET", headers: {}, socket: { remoteAddress: "127.0.0.1" } } as any;
    const res = createMockResponse();

    const handled = await router.handleRequest(req, res as any, "/logo.svg", new URL("http://localhost/logo.svg"));
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toBe("image/svg+xml");
    expect(res.body).toContain("<svg");
    expect(res.body).toContain('id="wordmark"');
    expect(res.body).toContain('id="icon1"');
  });

  it("fetches single audit record by ID", async () => {
    const req = {
      method: "GET",
      headers: { authorization: "Bearer test-secret-key-12345" },
      socket: { remoteAddress: "127.0.0.1" },
    } as any;
    const res = createMockResponse();

    const handled = await router.handleRequest(req, res as any, "/api/audit-logs/audit-123", new URL("http://localhost/api/audit-logs/audit-123"));
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.audit.id).toBe("audit-123");
    expect(body.audit.action).toBe("run_job");
  });

  it("clears historical scheduler data and resets console", async () => {
    const req = {
      method: "POST",
      headers: { authorization: "Bearer test-secret-key-12345" },
      socket: { remoteAddress: "127.0.0.1" },
      on: (event: string, cb: any) => {
        if (event === "data") cb(JSON.stringify({ clearRuns: true, clearFailures: true, clearAudit: false }));
        if (event === "end") cb();
      },
    } as any;
    const res = createMockResponse();

    const handled = await router.handleRequest(req, res as any, "/api/scheduler/clear-history", new URL("http://localhost/api/scheduler/clear-history"));
    expect(handled).toBe(true);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.success).toBe(true);
    expect(body.deletedRuns).toBe(10);
    expect(mockRunner.resetConsecutiveFailures).toHaveBeenCalled();
    expect(mockDbClient.clearHistory).toHaveBeenCalledWith(
      expect.objectContaining({ clearRuns: true, clearFailures: true, clearAudit: false })
    );
  });
});
