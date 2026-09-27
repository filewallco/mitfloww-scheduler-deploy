import http from "node:http";
import { URL } from "node:url";
import type { DatabaseClient } from "../database/client.js";
import type { JobRunner } from "../core/job-runner.js";
import type { SchedulerService } from "../core/scheduler.js";
import type { JobRegistry } from "../core/job-registry.js";
import { logger } from "../utils/logger.js";
import { ApiRouter } from "../api/router.js";
import { renderAdminHtml } from "../ui/admin-ui.html.js";

export class HealthServer {
  private server: http.Server | null = null;
  private startedAt = new Date();
  private router: ApiRouter;

  constructor(
    private port: number,
    private dbClient: DatabaseClient,
    private runner: JobRunner,
    private scheduler?: SchedulerService,
    private registry?: JobRegistry
  ) {
    this.router = new ApiRouter({
      dbClient: this.dbClient,
      runner: this.runner,
      scheduler: this.scheduler || ({} as any),
      registry: this.registry || ({} as any),
      startedAt: this.startedAt,
    });
  }

  start(): void {
    this.server = http.createServer(async (req, res) => {
      try {
        const host = req.headers.host || `localhost:${this.port}`;
        const parsedUrl = new URL(req.url || "/", `http://${host}`);
        const pathname = parsedUrl.pathname;

        // 1. Serve Admin Operations Single-Page Application
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

        // 2. Delegate to API router for /health, /live, /ready, /api/*
        const handled = await this.router.handleRequest(req, res, pathname, parsedUrl);
        if (handled) {
          return;
        }

        // 3. Fallback 404
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not Found", path: pathname }));
      } catch (err) {
        logger.error("[HealthServer] Unhandled request error", { error: err });
        if (!res.headersSent) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal Server Error" }));
        }
      }
    });

    this.server.listen(this.port, () => {
      logger.info(
        `[HealthServer] Scheduler Operations & Admin Server listening on http://localhost:${this.port} (Admin UI: /, Health: /health)`
      );
    });

    this.server.on("error", (err) => {
      logger.error("[HealthServer] Server error", { error: err });
    });
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    return new Promise((resolve) => {
      this.server?.close(() => {
        logger.info("[HealthServer] Operations and health server stopped.");
        resolve();
      });
    });
  }
}
