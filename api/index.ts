import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";
import { renderAdminHtml } from "../src/ui/admin-ui.html.js";
import { MITFLOWW_LOGO_SVG } from "../src/ui/logo.js";
import { verifyCronAuth } from "../src/api/auth.js";
import { logger } from "../src/utils/logger.js";
import { getAppContext } from "../src/core/bootstrap.js";

/**
 * Vercel Serverless Function entry point.
 * Serves the Scheduler Admin Operations Console, Health checks, API endpoints,
 * and Vercel Cron execution handlers with strict authentication.
 */
export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const host = req.headers.host || "localhost";

    // Resolve true requested path across Vercel rewrites and standard HTTP
    const rawPath =
      (req.headers["x-matched-path"] as string) ||
      (req.headers["x-forwarded-uri"] as string) ||
      (req.headers["x-invoke-path"] as string) ||
      req.url ||
      "/";

    const parsedUrl = new URL(rawPath, `https://${host}`);
    let pathname = parsedUrl.pathname;

    // Normalize direct invocation of the serverless function name to root UI
    if (pathname === "/api/index" || pathname === "/api" || pathname === "" || pathname === "/index") {
      pathname = "/";
    }

    // 1. Serve Admin Operations UI IMMEDIATELY (Zero cold-start DB delay)
    if (pathname === "/" || pathname === "/admin" || pathname === "/admin/") {
      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Cache-Control": "no-cache, must-revalidate",
      });
      res.end(renderAdminHtml());
      return;
    }

    // 2. Serve brand logo
    if (pathname === "/logo.svg") {
      res.writeHead(200, {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400",
      });
      res.end(MITFLOWW_LOGO_SVG);
      return;
    }

    // Lazy load core services (singleton instance cached in memory across warm serverless requests)
    const ctx = await getAppContext();

    // 3. Vercel Cron Endpoint (Protected with verifyCronAuth)
    if (pathname === "/api/cron") {
      const cronAuth = verifyCronAuth(req);
      if (!cronAuth.authenticated) {
        logger.warn(`[Cron] Unauthorized cron trigger attempt from ${cronAuth.actor}`);
        res.writeHead(401, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Unauthorized",
            message: "Valid CRON_SECRET or SCHEDULER_ADMIN_KEY required to trigger maintenance cron.",
          })
        );
        return;
      }

      logger.info(`[Cron] Authorized maintenance trigger initiated by ${cronAuth.actor}`);

      const specificJobName = parsedUrl.searchParams.get("job");
      const enabledJobs = ctx.registry.getEnabled();
      const jobsToRun = specificJobName
        ? enabledJobs.filter((j) => j.name === specificJobName)
        : enabledJobs;

      if (jobsToRun.length === 0) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: `Job not found: ${specificJobName}` }));
        return;
      }

      const results = [];
      const triggerSource: "scheduler" | "admin" = cronAuth.actor === "vercel-cron" ? "scheduler" : "admin";
      for (const job of jobsToRun) {
        try {
          const runResult = await ctx.runner.runJob(job, triggerSource);
          results.push(runResult);
        } catch (jobErr: any) {
          results.push({
            jobName: job.name,
            status: "failed",
            error: jobErr?.message || String(jobErr),
          });
        }
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          success: true,
          triggeredBy: cronAuth.actor,
          timestamp: new Date().toISOString(),
          results,
        })
      );
      return;
    }

    // 4. Delegate to API router (/health, /live, /ready, /api/*)
    const handled = await ctx.router.handleRequest(req, res, pathname, parsedUrl);
    if (handled) {
      return;
    }

    // 5. Fallback 404
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not Found", path: pathname }));
  } catch (err: any) {
    logger.error("[VercelHandler] Unhandled request error", { error: err });
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          error: "Internal Server Error",
          message: err?.message || "An unexpected error occurred",
          tip: "Check database and Cloudflare R2 environment variables in Vercel settings.",
        })
      );
    }
  }
}
