import http from "node:http";
import type { DatabaseClient } from "../database/client.js";
import type { JobRunner } from "../core/job-runner.js";
import { logger } from "../utils/logger.js";
import { testR2Connection } from "../storage/r2-client.js";

export class HealthServer {
  private server: http.Server | null = null;
  private startedAt = new Date();

  constructor(
    private port: number,
    private dbClient: DatabaseClient,
    private runner: JobRunner
  ) {}

  start(): void {
    this.server = http.createServer(async (req, res) => {
      const url = req.url || "/";

      if (url === "/health" || url === "/live") {
        const uptimeSeconds = Math.floor((Date.now() - this.startedAt.getTime()) / 1000);
        const dbHealthy = await this.dbClient.healthCheck();
        const r2Healthy = await testR2Connection();
        const jobStatuses = this.runner.getAllStatuses();

        const hasRecentFailures = Object.values(jobStatuses).some(
          (j) => j.consecutiveFailures > 2
        );

        const status = (!dbHealthy || !r2Healthy)
          ? "unhealthy"
          : hasRecentFailures
          ? "degraded"
          : "healthy";

        const statusCode = status === "unhealthy" ? 503 : 200;

        res.writeHead(statusCode, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            status,
            uptimeSeconds,
            database: dbHealthy ? "connected" : "disconnected",
            storage: r2Healthy ? "connected" : "disconnected",
            timestamp: new Date().toISOString(),
            jobs: jobStatuses,
          }, null, 2)
        );
        return;
      }

      if (url === "/ready") {
        const dbHealthy = await this.dbClient.healthCheck();
        const r2Healthy = await testR2Connection();
        const ready = dbHealthy && r2Healthy;

        res.writeHead(ready ? 200 : 503, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ready }));
        return;
      }

      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not Found");
    });

    this.server.listen(this.port, () => {
      logger.info(`[HealthServer] Health check server listening on port ${this.port} (/health, /live, /ready)`);
    });

    this.server.on("error", (err) => {
      logger.error("[HealthServer] Server error", { error: err });
    });
  }

  async stop(): Promise<void> {
    if (!this.server) return;
    return new Promise((resolve) => {
      this.server?.close(() => {
        logger.info("[HealthServer] Health server stopped.");
        resolve();
      });
    });
  }
}
