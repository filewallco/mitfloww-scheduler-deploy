import type http from "node:http";
import { URL } from "node:url";
import type { DatabaseClient } from "../database/client.js";
import type { JobRunner } from "../core/job-runner.js";
import type { SchedulerService } from "../core/scheduler.js";
import type { JobRegistry } from "../core/job-registry.js";
import { testR2Connection } from "../storage/r2-client.js";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { authenticateLogin, getClientIp, verifyAuth } from "./auth.js";
import { MITFLOWW_LOGO_SVG } from "../ui/logo.js";

export interface ApiContext {
  dbClient: DatabaseClient;
  runner: JobRunner;
  scheduler: SchedulerService;
  registry: JobRegistry;
  startedAt: Date;
}

/**
 * Sends JSON response with status and headers.
 */
export function sendJson(res: http.ServerResponse, statusCode: number, data: unknown, extraHeaders: Record<string, string> = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    ...extraHeaders,
  });
  res.end(JSON.stringify(data));
}

/**
 * Parses JSON request body up to 1MB. Supports both raw HTTP streams and pre-parsed serverless bodies.
 */
export async function parseJsonBody<T = Record<string, unknown>>(req: http.IncomingMessage): Promise<T> {
  const anyReq = req as any;
  if (anyReq.body !== undefined && anyReq.body !== null) {
    if (typeof anyReq.body === "object") {
      return anyReq.body as T;
    }
    if (typeof anyReq.body === "string") {
      if (!anyReq.body.trim()) return {} as T;
      try {
        return JSON.parse(anyReq.body) as T;
      } catch {
        throw new Error("Malformed JSON payload");
      }
    }
  }

  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        req.destroy();
        reject(new Error("Request payload too large (max 1MB)"));
      }
    });
    req.on("end", () => {
      if (!body.trim()) {
        return resolve({} as T);
      }
      try {
        const parsed = JSON.parse(body);
        resolve(parsed);
      } catch (err) {
        reject(new Error("Malformed JSON payload"));
      }
    });
    req.on("error", (err) => reject(err));
  });
}

export class ApiRouter {
  constructor(private ctx: ApiContext) {}

  async handleRequest(req: http.IncomingMessage, res: http.ServerResponse, pathname: string, parsedUrl: URL): Promise<boolean> {
    // 1. Public Health & Liveness Endpoints
    if (pathname === "/health" || pathname === "/live") {
      await this.handleHealth(res);
      return true;
    }
    if (pathname === "/logo.svg" && req.method === "GET") {
      res.writeHead(200, {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400",
      });
      res.end(MITFLOWW_LOGO_SVG);
      return true;
    }

    if (pathname === "/ready") {
      await this.handleReady(res);
      return true;
    }

    // 2. Authentication endpoints
    if (pathname === "/api/auth/check" && req.method === "GET") {
      const auth = verifyAuth(req);
      sendJson(res, 200, {
        authenticated: auth.authenticated,
        actor: auth.actor,
        dryRun: env.DRY_RUN,
        nodeEnv: env.NODE_ENV,
        uptimeSeconds: Math.floor((Date.now() - this.ctx.startedAt.getTime()) / 1000),
      });
      return true;
    }

    if (pathname === "/api/auth/login" && req.method === "POST") {
      try {
        const body = await parseJsonBody<{ key?: string }>(req);
        if (!body.key) {
          sendJson(res, 400, { success: false, error: "Access key is required." });
          return true;
        }

        const authResult = authenticateLogin(req, body.key);
        if (!authResult.success || !authResult.token) {
          sendJson(res, 401, { success: false, error: authResult.error || "Invalid access key." });
          return true;
        }

        const isSecure = env.NODE_ENV === "production";
        const cookie = `scheduler_admin_token=${encodeURIComponent(authResult.token)}; Path=/; HttpOnly; SameSite=Strict${isSecure ? "; Secure" : ""}; Max-Age=86400`;

        await this.ctx.dbClient.recordAdminAudit({
          action: "admin_login",
          actor: getClientIp(req),
          result: "success",
          metadata: { ip: getClientIp(req) },
        });

        sendJson(res, 200, { success: true, token: authResult.token }, { "Set-Cookie": cookie });
        return true;
      } catch (err: any) {
        sendJson(res, 400, { success: false, error: err.message || "Invalid request." });
        return true;
      }
    }

    if (pathname === "/api/auth/logout" && req.method === "POST") {
      const cookie = "scheduler_admin_token=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0";
      sendJson(res, 200, { success: true }, { "Set-Cookie": cookie });
      return true;
    }

    // From here on, all /api/* routes require authentication
    if (pathname.startsWith("/api/")) {
      const auth = verifyAuth(req);
      if (!auth.authenticated) {
        sendJson(res, 401, {
          error: "Unauthorized",
          message: "Valid Bearer token, x-scheduler-key header, or active admin session required.",
        });
        return true;
      }

      return await this.handleProtectedApi(req, res, pathname, parsedUrl, auth.actor);
    }

    return false;
  }

  private async handleHealth(res: http.ServerResponse): Promise<void> {
    const uptimeSeconds = Math.floor((Date.now() - this.ctx.startedAt.getTime()) / 1000);
    const dbHealthy = await this.ctx.dbClient.healthCheck();
    const r2Healthy = await testR2Connection();
    const jobStatuses = this.ctx.runner.getAllStatuses();

    const hasRecentFailures = Object.values(jobStatuses).some((j) => j.consecutiveFailures > 2);
    const isPaused = this.ctx.scheduler.getStatus().isPaused;

    const status = !dbHealthy || !r2Healthy ? "unhealthy" : hasRecentFailures ? "degraded" : "healthy";
    const statusCode = status === "unhealthy" ? 503 : 200;

    sendJson(res, statusCode, {
      status,
      uptimeSeconds,
      isPaused,
      dryRun: env.DRY_RUN,
      database: dbHealthy ? "connected" : "disconnected",
      storage: r2Healthy ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
      jobs: jobStatuses,
    });
  }

  private async handleReady(res: http.ServerResponse): Promise<void> {
    const dbHealthy = await this.ctx.dbClient.healthCheck();
    const r2Healthy = await testR2Connection();
    const ready = dbHealthy && r2Healthy;
    sendJson(res, ready ? 200 : 503, { ready });
  }

  private async handleProtectedApi(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
    url: URL,
    actor: string
  ): Promise<boolean> {
    const method = req.method || "GET";

    // 1. Scheduler status & metrics
    if (pathname === "/api/scheduler/status" && method === "GET") {
      const [dbHealthy, r2Healthy, metrics] = await Promise.all([
        this.ctx.dbClient.healthCheck(),
        testR2Connection(),
        this.ctx.dbClient.getOverallMetrics(),
      ]);

      const schedulerStatus = this.ctx.scheduler.getStatus();
      const activeExecutions = this.ctx.runner.getActiveExecutions();
      const jobStatuses = this.ctx.runner.getAllStatuses();

      let overallStatus = "running";
      if (!dbHealthy || !r2Healthy) {
        overallStatus = "degraded";
      } else if (schedulerStatus.isPaused) {
        overallStatus = "paused";
      } else if (!schedulerStatus.isRunning) {
        overallStatus = "stopped";
      }

      sendJson(res, 200, {
        status: overallStatus,
        scheduler: schedulerStatus,
        database: dbHealthy ? "connected" : "disconnected",
        storage: r2Healthy ? "connected" : "disconnected",
        dryRun: env.DRY_RUN,
        uptimeSeconds: Math.floor((Date.now() - this.ctx.startedAt.getTime()) / 1000),
        activeExecutions,
        jobStatuses,
        metrics,
      });
      return true;
    }

    if (pathname === "/api/scheduler/clear-history" && method === "POST") {
      let body: { clearRuns?: boolean; clearFailures?: boolean; clearAudit?: boolean } = {}; try { body = await parseJsonBody(req); } catch {}
      const deleted = await this.ctx.dbClient.clearHistory({
        clearRuns: body.clearRuns ?? true,
        clearFailures: body.clearFailures ?? true,
        clearAudit: body.clearAudit ?? false,
      });
      this.ctx.runner.resetConsecutiveFailures();
      await this.ctx.dbClient.recordAdminAudit({
        action: "clear_history",
        actor,
        result: "success",
        metadata: { deletedRuns: deleted.deletedRuns, deletedFailures: deleted.deletedFailures },
      });
      sendJson(res, 200, { success: true, ...deleted });
      return true;
    }

    if (pathname === "/api/scheduler/metrics" && method === "GET") {
      const metrics = await this.ctx.dbClient.getOverallMetrics();
      sendJson(res, 200, metrics);
      return true;
    }

    if (pathname === "/api/scheduler/pause" && method === "POST") {
      const result = this.ctx.scheduler.pause(actor);
      await this.ctx.dbClient.recordAdminAudit({
        action: "pause_scheduler",
        actor,
        result: "success",
        metadata: { wasPaused: result.wasPaused },
      });
      sendJson(res, 200, { success: true, isPaused: true, wasPaused: result.wasPaused });
      return true;
    }

    if (pathname === "/api/scheduler/resume" && method === "POST") {
      const result = this.ctx.scheduler.resume(actor);
      await this.ctx.dbClient.recordAdminAudit({
        action: "resume_scheduler",
        actor,
        result: "success",
        metadata: { wasPaused: result.wasPaused },
      });
      sendJson(res, 200, { success: true, isPaused: false, wasPaused: result.wasPaused });
      return true;
    }

    // 2. Jobs listing & details
    if (pathname === "/api/jobs" && method === "GET") {
      const allJobs = this.ctx.registry.getAll();
      const activeExecutions = this.ctx.runner.getActiveExecutions();

      const jobsData = allJobs.map((job) => {
        const status = this.ctx.runner.getStatus(job.name);
        const active = activeExecutions.find((e) => e.jobName === job.name);
        return {
          name: job.name,
          description: job.description,
          intervalMs: job.intervalMs,
          initialDelayMs: job.initialDelayMs ?? 0,
          enabled: job.enabled !== false,
          status: active ? "running" : status.lastStatus,
          lastRunAt: status.lastRunAt,
          lastCompletedAt: status.lastCompletedAt,
          lastDurationMs: status.lastDurationMs,
          lastError: status.lastError,
          lastResult: status.lastResult,
          consecutiveFailures: status.consecutiveFailures,
          activeExecution: active || null,
        };
      });

      sendJson(res, 200, { jobs: jobsData, count: jobsData.length });
      return true;
    }

    // Single job: GET /api/jobs/:jobName
    const jobDetailMatch = pathname.match(/^\/api\/jobs\/([a-zA-Z0-9_-]+)$/);
    if (jobDetailMatch && method === "GET") {
      const jobName = jobDetailMatch[1];
      const job = this.ctx.registry.get(jobName);
      if (!job) {
        sendJson(res, 404, { error: `Job "${jobName}" is not registered.` });
        return true;
      }

      const status = this.ctx.runner.getStatus(job.name);
      const active = this.ctx.runner.getActiveExecutions().find((e) => e.jobName === job.name);
      const recentRuns = await this.ctx.dbClient.getJobRuns({ jobName: job.name, limit: 10 });

      sendJson(res, 200, {
        job: {
          name: job.name,
          description: job.description,
          intervalMs: job.intervalMs,
          initialDelayMs: job.initialDelayMs ?? 0,
          enabled: job.enabled !== false,
          status: active ? "running" : status.lastStatus,
          lastRunAt: status.lastRunAt,
          lastCompletedAt: status.lastCompletedAt,
          lastDurationMs: status.lastDurationMs,
          lastError: status.lastError,
          lastResult: status.lastResult,
          consecutiveFailures: status.consecutiveFailures,
          activeExecution: active || null,
        },
        recentRuns: recentRuns.items,
      });
      return true;
    }

    // Run job: POST /api/jobs/:jobName/run
    const runMatch = pathname.match(/^\/api\/jobs\/([a-zA-Z0-9_-]+)\/run$/);
    if (runMatch && method === "POST") {
      const jobName = runMatch[1];
      const job = this.ctx.registry.get(jobName);
      if (!job) {
        sendJson(res, 404, { error: `Job "${jobName}" is not registered in this scheduler instance.` });
        return true;
      }

      const currentStatus = this.ctx.runner.getStatus(job.name);
      if (currentStatus.lastStatus === "running") {
        await this.ctx.dbClient.recordAdminAudit({
          action: "run_job",
          jobName: job.name,
          actor,
          result: "locked",
          metadata: { message: "Job is already running locally." },
        });
        sendJson(res, 409, { success: false, error: `Job "${jobName}" is already currently running.` });
        return true;
      }

      // Trigger execution asynchronously through standard JobRunner
      void this.ctx.runner.runJob(job, "admin").catch((err) => {
        logger.error(`[ManualTrigger] Error executing job "${jobName}"`, { error: err });
      });

      await this.ctx.dbClient.recordAdminAudit({
        action: "run_job",
        jobName: job.name,
        actor,
        result: "success",
        metadata: { dryRun: env.DRY_RUN },
      });

      sendJson(res, 202, {
        success: true,
        message: `Job "${jobName}" triggered successfully. Execution dispatched to runner.`,
        jobName: job.name,
        dryRun: env.DRY_RUN,
      });
      return true;
    }

    // 3. Execution runs: GET /api/runs
    if (pathname === "/api/runs" && method === "GET") {
      const limit = Number(url.searchParams.get("limit")) || 25;
      const offset = Number(url.searchParams.get("offset")) || 0;
      const jobName = url.searchParams.get("jobName") || undefined;
      const status = url.searchParams.get("status") || undefined;
      const search = url.searchParams.get("search") || undefined;
      const fromStr = url.searchParams.get("from");
      const toStr = url.searchParams.get("to");

      const from = fromStr ? new Date(fromStr) : undefined;
      const to = toStr ? new Date(toStr) : undefined;

      const result = await this.ctx.dbClient.getJobRuns({
        limit,
        offset,
        jobName,
        status,
        search,
        from: from && !isNaN(from.getTime()) ? from : undefined,
        to: to && !isNaN(to.getTime()) ? to : undefined,
      });

      sendJson(res, 200, result);
      return true;
    }

    // Single run: GET /api/runs/:executionId
    const singleRunMatch = pathname.match(/^\/api\/runs\/([a-zA-Z0-9_-]+)$/);
    if (singleRunMatch && method === "GET") {
      const executionId = singleRunMatch[1];
      const run = await this.ctx.dbClient.getJobRunByExecutionId(executionId);
      if (!run) {
        sendJson(res, 404, { error: `Execution "${executionId}" not found.` });
        return true;
      }
      sendJson(res, 200, { run });
      return true;
    }

    // Cancel run: POST /api/runs/:executionId/cancel
    const cancelMatch = pathname.match(/^\/api\/runs\/([a-zA-Z0-9_-]+)\/cancel$/);
    if (cancelMatch && method === "POST") {
      const executionId = cancelMatch[1];
      const cancelResult = await this.ctx.runner.cancelExecution(executionId, actor);

      if (!cancelResult.cancelled) {
        sendJson(res, 404, { success: false, error: cancelResult.message });
        return true;
      }

      sendJson(res, 200, { success: true, message: cancelResult.message });
      return true;
    }

    // 4. Failure Logs: GET /api/failures
    if (pathname === "/api/failures" && method === "GET") {
      const limit = Number(url.searchParams.get("limit")) || 25;
      const offset = Number(url.searchParams.get("offset")) || 0;
      const jobName = url.searchParams.get("jobName") || undefined;
      const severity = url.searchParams.get("severity") || undefined;
      const search = url.searchParams.get("search") || undefined;
      const retryableParam = url.searchParams.get("retryable");
      const retryable = retryableParam !== null ? retryableParam === "true" : undefined;
      const fromStr = url.searchParams.get("from");
      const toStr = url.searchParams.get("to");

      const from = fromStr ? new Date(fromStr) : undefined;
      const to = toStr ? new Date(toStr) : undefined;

      const result = await this.ctx.dbClient.getFailureLogs({
        limit,
        offset,
        jobName,
        severity,
        retryable,
        search,
        from: from && !isNaN(from.getTime()) ? from : undefined,
        to: to && !isNaN(to.getTime()) ? to : undefined,
      });

      sendJson(res, 200, result);
      return true;
    }

    // Single failure: GET /api/failures/:id
    const failureDetailMatch = pathname.match(/^\/api\/failures\/([a-zA-Z0-9_-]+)$/);
    if (failureDetailMatch && method === "GET") {
      const id = failureDetailMatch[1];
      const failure = await this.ctx.dbClient.getFailureLogById(id);
      if (!failure) {
        sendJson(res, 404, { error: `Failure log "${id}" not found.` });
        return true;
      }
      sendJson(res, 200, { failure });
      return true;
    }

    // 5. Admin Audit Trail: GET /api/audit-logs
    if (pathname.startsWith("/api/audit-logs/") && method === "GET") {
      const auditId = pathname.replace("/api/audit-logs/", "");
      const audit = await this.ctx.dbClient.getAdminAuditLogById(auditId);
      if (!audit) {
        sendJson(res, 404, { error: "Audit record not found" });
        return true;
      }
      sendJson(res, 200, { audit });
      return true;
    }

    if (pathname === "/api/audit-logs" && method === "GET") {
      const limit = Number(url.searchParams.get("limit")) || 25;
      const offset = Number(url.searchParams.get("offset")) || 0;
      const action = url.searchParams.get("action") || undefined;
      const jobName = url.searchParams.get("jobName") || undefined;
      const search = url.searchParams.get("search") || undefined;

      const result = await this.ctx.dbClient.getAdminAuditLogs({
        limit,
        offset,
        action,
        jobName,
        search,
      });

      sendJson(res, 200, result);
      return true;
    }

    // 6. Test failure ingestion (for verification testing)
    if (pathname === "/api/test/failure" && method === "POST") {
      try {
        const body = await parseJsonBody<{ jobName?: string; errorMessage?: string }>(req);
        const testJobName = body.jobName || "expired-projects";
        const testError = body.errorMessage || "Controlled test verification failure from Admin UI";

        await this.ctx.dbClient.recordFailure({
          executionId: "test-exec-" + Date.now(),
          jobName: testJobName,
          severity: "error",
          errorCode: "CONTROLLED_TEST_ERROR",
          errorMessage: testError,
          operation: "testVerification",
          entityType: "test_entity",
          entityId: "test-id-123",
          retryable: false,
          attempt: 1,
        });

        await this.ctx.dbClient.recordAdminAudit({
          action: "test_failure",
          jobName: testJobName,
          actor,
          result: "success",
          metadata: { message: testError },
        });

        sendJson(res, 200, { success: true, message: "Test failure log inserted successfully." });
        return true;
      } catch (err: any) {
        sendJson(res, 400, { error: err.message });
        return true;
      }
    }

    sendJson(res, 404, { error: "API route not found." });
    return true;
  }
}
