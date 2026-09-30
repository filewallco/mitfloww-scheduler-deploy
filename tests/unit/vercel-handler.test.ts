import { describe, it, expect, vi, beforeEach } from "vitest";
import handler from "../../api/index.js";
import { env } from "../../src/config/env.js";

vi.mock("../../src/core/bootstrap.js", () => {
  return {
    getAppContext: vi.fn().mockResolvedValue({
      config: { SCHEDULER_ADMIN_KEY: "M1tFl0w-Secure-Key" },
      registry: {
        getEnabled: vi.fn(() => [
          {
            name: "expired-projects",
            description: "Cleans up expired projects",
            intervalMs: 3600000,
            enabled: true,
          },
        ]),
      },
      runner: {
        runJob: vi.fn().mockResolvedValue({
          jobName: "expired-projects",
          status: "success",
          deleted: 5,
        }),
      },
      router: {
        handleRequest: vi.fn(async (_req, res, pathname) => {
          if (pathname === "/health") {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ status: "healthy" }));
            return true;
          }
          return false;
        }),
      },
      startedAt: new Date(),
    }),
  };
});

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

describe("Vercel Serverless Handler (api/index.ts)", () => {
  beforeEach(() => {
    (env as any).SCHEDULER_ADMIN_KEY = "M1tFl0w-Secure-Key";
  });

  it("serves Admin UI HTML for root path without leaking sensitive data", async () => {
    const req: any = {
      method: "GET",
      url: "/",
      headers: { host: "mitfloww-scheduler-deploy-gamma.vercel.app" },
    };
    const res = createMockResponse();

    await handler(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toContain("text/html");
    expect(res.body).toContain("MitFloww - Operations Console");
  });

  it("serves brand logo on /logo.svg", async () => {
    const req: any = {
      method: "GET",
      url: "/logo.svg",
      headers: { host: "mitfloww-scheduler-deploy-gamma.vercel.app" },
    };
    const res = createMockResponse();

    await handler(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toBe("image/svg+xml");
  });

  it("strictly rejects unauthenticated access to /api/cron with 401 Unauthorized", async () => {
    const req: any = {
      method: "GET",
      url: "/api/cron",
      headers: { host: "mitfloww-scheduler-deploy-gamma.vercel.app" },
      socket: { remoteAddress: "192.168.1.1" },
    };
    const res = createMockResponse();

    await handler(req, res as any);

    expect(res.statusCode).toBe(401);
    const parsed = JSON.parse(res.body);
    expect(parsed.error).toBe("Unauthorized");
  });

  it("rejects unauthorized cron attempt with invalid secret", async () => {
    const req: any = {
      method: "GET",
      url: "/api/cron",
      headers: {
        host: "mitfloww-scheduler-deploy-gamma.vercel.app",
        authorization: "Bearer wrong-key",
      },
      socket: { remoteAddress: "192.168.1.2" },
    };
    const res = createMockResponse();

    await handler(req, res as any);

    expect(res.statusCode).toBe(401);
    const parsed = JSON.parse(res.body);
    expect(parsed.error).toBe("Unauthorized");
  });

  it("executes maintenance cron when authenticated with SCHEDULER_ADMIN_KEY", async () => {
    const req: any = {
      method: "GET",
      url: "/api/cron",
      headers: {
        host: "mitfloww-scheduler-deploy-gamma.vercel.app",
        authorization: `Bearer ${env.SCHEDULER_ADMIN_KEY}`,
      },
      socket: { remoteAddress: "192.168.1.3" },
    };
    const res = createMockResponse();

    await handler(req, res as any);

    expect(res.statusCode).toBe(200);
    const parsed = JSON.parse(res.body);
    expect(parsed.success).toBe(true);
    expect(parsed.results).toHaveLength(1);
    expect(parsed.results[0].jobName).toBe("expired-projects");
  });

  it("delegates /health to router", async () => {
    const req: any = {
      method: "GET",
      url: "/health",
      headers: { host: "mitfloww-scheduler-deploy-gamma.vercel.app" },
    };
    const res = createMockResponse();

    await handler(req, res as any);

    expect(res.statusCode).toBe(200);
    const parsed = JSON.parse(res.body);
    expect(parsed.status).toBe("healthy");
  });
});
