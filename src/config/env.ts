import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z
  .object({
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

    // Database
    DATABASE_URL: z
      .string()
      .default(() =>
        process.env.NODE_ENV === "test" || process.env.VITEST
          ? "postgresql://localhost:5432/test_db"
          : ""
      )
      .refine((val) => val.length > 0, {
        message: "DATABASE_URL is required for MitFloww Scheduler",
      }),
    DB_POOL_MIN: z.coerce.number().int().min(1).max(10).default(1),
    DB_POOL_MAX: z.coerce.number().int().min(1).max(20).default(5),
    DB_IDLE_TIMEOUT_MS: z.coerce.number().int().min(1000).default(30000),

    // Schema Management & Audit Retention
    AUTO_CREATE_AUDIT_TABLE: z.coerce.boolean().default(true),
    AUDIT_LOG_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),

    // Production guardrail
    ALLOW_LOCALHOST_DB_IN_PRODUCTION: z.coerce.boolean().default(false),

    // Cloudflare R2
    R2_ACCOUNT_ID: z.string().optional(),
    R2_ACCESS_KEY_ID: z.string().optional(),
    R2_SECRET_ACCESS_KEY: z.string().optional(),
    R2_BUCKET_NAME: z
      .string()
      .default(() =>
        process.env.NODE_ENV === "test" || process.env.VITEST ? "test-bucket" : ""
      )
      .refine((val) => val.length > 0, {
        message: "R2_BUCKET_NAME is required",
      }),
    ASSETS_BUCKET_NAME: z.string().default("mitfloww-assets"),
    R2_S3_ENDPOINT: z.string().optional(),
    R2_CONNECT_TIMEOUT_MS: z.coerce.number().int().min(1000).max(60000).default(10000),
    R2_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(120000).default(30000),
    R2_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(3),

    // Master Scheduler Settings
    SCHEDULER_ENABLED: z.coerce.boolean().default(true),
    DRY_RUN: z.coerce.boolean().default(false),
    LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),
    SCHEDULER_TICK_INTERVAL_MS: z.coerce.number().int().min(1000).max(3600000).default(10000),
    SCHEDULER_BATCH_SIZE: z.coerce.number().int().min(1).max(1000).default(100),
    SCHEDULER_MAX_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(3),

    // Health Server
    HEALTH_SERVER_ENABLED: z.coerce.boolean().default(true),
    HEALTH_SERVER_PORT: z.coerce.number().int().min(1024).max(65535).default(4002),

    // System-level retention periods (authoritative for system policy)
    ACCOUNT_DELETION_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
    STALE_UPLOAD_RETENTION_HOURS: z.coerce.number().int().min(1).max(720).default(24),
    ORPHANED_FILE_RETENTION_HOURS: z.coerce.number().int().min(1).max(720).default(48),
    SOFT_DELETED_ASSET_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(14),
    RESOLVED_REPORT_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(30),

    // Distributed lock
    LOCK_TTL_MS: z.coerce.number().int().min(5000).max(300000).default(60000),
  })
  .superRefine((data, ctx) => {
    // In production, require Cloudflare R2 credentials
    if (data.NODE_ENV === "production" && !process.env.VITEST) {
      if (!data.R2_ACCOUNT_ID || data.R2_ACCOUNT_ID.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "R2_ACCOUNT_ID is required in production environment",
          path: ["R2_ACCOUNT_ID"],
        });
      }
      if (!data.R2_ACCESS_KEY_ID || data.R2_ACCESS_KEY_ID.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "R2_ACCESS_KEY_ID is required in production environment",
          path: ["R2_ACCESS_KEY_ID"],
        });
      }
      if (!data.R2_SECRET_ACCESS_KEY || data.R2_SECRET_ACCESS_KEY.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "R2_SECRET_ACCESS_KEY is required in production environment",
          path: ["R2_SECRET_ACCESS_KEY"],
        });
      }
    }
  });

export type EnvConfig = z.infer<typeof envSchema>;

let parsedEnv: EnvConfig;

export function loadEnv(): EnvConfig {
  if (parsedEnv) return parsedEnv;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.format();
    console.error("[ConfigError] Invalid scheduler configuration:", JSON.stringify(formatted, null, 2));
    throw new Error("Invalid scheduler environment configuration. Check logs above.");
  }

  // Production safety check
  if (result.data.NODE_ENV === "production") {
    const isLocalDb = result.data.DATABASE_URL.includes("localhost") || result.data.DATABASE_URL.includes("127.0.0.1");
    if (isLocalDb && !result.data.ALLOW_LOCALHOST_DB_IN_PRODUCTION) {
      throw new Error(
        "[StartupSafety] Production mode detected with localhost DATABASE_URL! Refusing to start without ALLOW_LOCALHOST_DB_IN_PRODUCTION=true."
      );
    }
  }

  parsedEnv = result.data;
  return parsedEnv;
}

export const env = loadEnv();
