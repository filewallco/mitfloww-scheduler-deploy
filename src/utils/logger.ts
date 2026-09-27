import { APP_NAME } from "../config/constants.js";

export type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
};

export interface LogMeta {
  executionId?: string;
  jobName?: string;
  durationMs?: number;
  scanned?: number;
  eligible?: number;
  processed?: number;
  deleted?: number;
  skipped?: number;
  failed?: number;
  error?: unknown;
  [key: string]: unknown;
}

export class Logger {
  private level: LogLevel;
  private defaultContext: Record<string, unknown>;

  constructor(level: LogLevel = "info", defaultContext: Record<string, unknown> = {}) {
    this.level = level;
    this.defaultContext = defaultContext;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.level];
  }

  private formatError(err: unknown): Record<string, unknown> {
    if (err instanceof Error) {
      return {
        message: err.message,
        name: err.name,
        stack: err.stack,
      };
    }
    return { raw: String(err) };
  }

  private log(level: LogLevel, message: string, meta?: LogMeta) {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const payload = {
      app: APP_NAME,
      timestamp,
      level,
      message,
      ...this.defaultContext,
      ...(meta || {}),
      ...(meta?.error ? { error: this.formatError(meta.error) } : {}),
    };

    const serialized = JSON.stringify(payload);
    if (level === "error") {
      process.stderr.write(serialized + "\n");
    } else {
      process.stdout.write(serialized + "\n");
    }
  }

  trace(message: string, meta?: LogMeta) { this.log("trace", message, meta); }
  debug(message: string, meta?: LogMeta) { this.log("debug", message, meta); }
  info(message: string, meta?: LogMeta) { this.log("info", message, meta); }
  warn(message: string, meta?: LogMeta) { this.log("warn", message, meta); }
  error(message: string, meta?: LogMeta) { this.log("error", message, meta); }

  child(context: Record<string, unknown>): Logger {
    return new Logger(this.level, { ...this.defaultContext, ...context });
  }
}

export const logger = new Logger(
  (process.env.LOG_LEVEL as LogLevel) || "info"
);
