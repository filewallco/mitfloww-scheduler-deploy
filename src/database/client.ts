import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, desc, eq, gt, gte, ilike, lt, lte, or, sql } from "drizzle-orm";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import * as schema from "./schema.js";

const { Pool } = pg;

export interface JobRunsQueryParams {
  limit?: number;
  offset?: number;
  cursor?: string;
  jobName?: string;
  status?: string;
  search?: string;
  from?: Date;
  to?: Date;
}

export interface FailureLogsQueryParams {
  limit?: number;
  offset?: number;
  cursor?: string;
  jobName?: string;
  severity?: string;
  retryable?: boolean;
  search?: string;
  from?: Date;
  to?: Date;
}

export interface AdminAuditQueryParams {
  limit?: number;
  offset?: number;
  action?: string;
  jobName?: string;
  result?: string;
  search?: string;
}

export interface InsertFailureLog {
  executionId?: string | null;
  jobName: string;
  severity?: "error" | "warn" | "fatal";
  errorCode?: string | null;
  errorMessage: string;
  operation?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  storageBucket?: string | null;
  storageKey?: string | null;
  retryable?: boolean;
  attempt?: number;
  stackTrace?: string | null;
  metadata?: Record<string, unknown> | string | null;
}

export interface InsertAdminAudit {
  action: string;
  jobName?: string | null;
  executionId?: string | null;
  actor?: string;
  result: "success" | "failed" | "locked" | "cancelled" | "rejected";
  metadata?: Record<string, unknown> | string | null;
}

/**
 * Strips secrets, connection strings, tokens, and signed URLs from text or metadata.
 */
function sanitizeString(str: string | null | undefined, maxLen = 2000): string | null {
  if (!str) return null;
  const sanitized = str
    .replace(new RegExp("(postgresql|postgres|https?)://[^@]+@", "gi"), "$1://***:***@")
    .replace(new RegExp("(Bearer|token|secret|accessKeyId|secretAccessKey|key)\\s*[:=]\\s*[^\\s,;\"']+", "gi"), "$1=***")
    .replace(new RegExp("X-Amz-Signature=[a-f0-9]+", "gi"), "X-Amz-Signature=***")
    .replace(new RegExp("X-Amz-Credential=[^&]+", "gi"), "X-Amz-Credential=***");
  return sanitized.length > maxLen ? sanitized.substring(0, maxLen - 3) + "..." : sanitized;
}


export interface ServiceLogsQueryParams {
  service?: "api" | "web" | "worker" | "scheduler" | "all";
  level?: string;
  search?: string;
  from?: Date;
  to?: Date;
  requestId?: string;
  correlationId?: string;
  limit?: number;
  offset?: number;
}

export interface UnifiedLogItem {
  id: number;
  service: "api" | "web" | "worker" | "scheduler";
  timestamp: Date;
  level: string;
  event: string;
  message: string;
  requestId?: string | null;
  correlationId?: string | null;
  userId?: string | null;
  durationMs?: number | null;
  statusCode?: number | null;
  component?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  hasStackTrace: boolean;
  hasMetadata: boolean;
  createdAt: Date;
}

export class DatabaseClient {
  private pool: pg.Pool;
  public readonly db: ReturnType<typeof drizzle<typeof schema>>;

  constructor() {
    this.pool = new Pool({
      connectionString: env.DATABASE_URL,
      min: env.DB_POOL_MIN,
      max: env.DB_POOL_MAX,
      idleTimeoutMillis: env.DB_IDLE_TIMEOUT_MS,
      connectionTimeoutMillis: 5000,
    });

    this.pool.on("error", (err) => {
      logger.error("[DatabasePool] Unexpected idle client error", { error: err });
    });

    this.db = drizzle(this.pool, { schema });
  }

  getPool(): pg.Pool {
    return this.pool;
  }

  /**
   * Performs basic connectivity check.
   */
  async healthCheck(): Promise<boolean> {
    try {
      const client = await this.pool.connect();
      try {
        await client.query("SELECT 1");
        return true;
      } finally {
        client.release();
      }
    } catch (err) {
      logger.error("[DatabaseClient] Health check query failed", { error: err });
      return false;
    }
  }

  /**
   * Verifies that the authoritative MitFloww schema exists.
   * If AUTO_CREATE_AUDIT_TABLE is true, ensures scheduler audit tables and failure logs exist.
   * Fails closed if the database does not contain the MitFloww schema.
   */
  async ensureSchemaAndTables(): Promise<void> {
    const client = await this.pool.connect();
    try {
      // 1. Verify mitfloww schema exists
      const schemaCheck = await client.query<{ exists: boolean }>(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.schemata WHERE schema_name = 'mitfloww'
        ) as exists;
      `);

      if (!schemaCheck.rows[0]?.exists) {
        throw new Error(
          '[DatabaseClient] Fail-Closed: PostgreSQL schema "mitfloww" does not exist! Refusing to start scheduler against uninitialized database.'
        );
      }

      // 2. Scheduler audit & operations tables handling
      if (env.AUTO_CREATE_AUDIT_TABLE) {
        await client.query(`
          CREATE TABLE IF NOT EXISTS mitfloww.scheduler_job_runs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            execution_id VARCHAR(255) NOT NULL,
            job_name VARCHAR(128) NOT NULL,
            status VARCHAR(32) NOT NULL,
            started_at TIMESTAMPTZ NOT NULL,
            completed_at TIMESTAMPTZ,
            duration_ms INTEGER,
            records_scanned INTEGER NOT NULL DEFAULT 0,
            records_eligible INTEGER NOT NULL DEFAULT 0,
            records_processed INTEGER NOT NULL DEFAULT 0,
            records_deleted INTEGER NOT NULL DEFAULT 0,
            records_skipped INTEGER NOT NULL DEFAULT 0,
            records_failed INTEGER NOT NULL DEFAULT 0,
            error_message TEXT,
            details TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS scheduler_job_runs_job_name_idx 
            ON mitfloww.scheduler_job_runs (job_name);
          CREATE INDEX IF NOT EXISTS scheduler_job_runs_started_at_idx 
            ON mitfloww.scheduler_job_runs (started_at DESC);
          CREATE INDEX IF NOT EXISTS scheduler_job_runs_execution_id_idx 
            ON mitfloww.scheduler_job_runs (execution_id);
          CREATE INDEX IF NOT EXISTS scheduler_job_runs_status_idx 
            ON mitfloww.scheduler_job_runs (status);

          CREATE TABLE IF NOT EXISTS mitfloww.scheduler_failure_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            execution_id VARCHAR(255),
            job_name VARCHAR(128) NOT NULL,
            severity VARCHAR(32) NOT NULL DEFAULT 'error',
            error_code VARCHAR(64),
            error_message TEXT NOT NULL,
            operation VARCHAR(128),
            entity_type VARCHAR(64),
            entity_id VARCHAR(255),
            storage_bucket VARCHAR(128),
            storage_key TEXT,
            retryable BOOLEAN NOT NULL DEFAULT false,
            attempt INTEGER NOT NULL DEFAULT 1,
            stack_trace TEXT,
            metadata TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS scheduler_failure_logs_job_name_idx 
            ON mitfloww.scheduler_failure_logs (job_name);
          CREATE INDEX IF NOT EXISTS scheduler_failure_logs_created_at_idx 
            ON mitfloww.scheduler_failure_logs (created_at DESC);
          CREATE INDEX IF NOT EXISTS scheduler_failure_logs_execution_id_idx 
            ON mitfloww.scheduler_failure_logs (execution_id);
          CREATE INDEX IF NOT EXISTS scheduler_failure_logs_severity_idx 
            ON mitfloww.scheduler_failure_logs (severity);

          CREATE TABLE IF NOT EXISTS mitfloww.scheduler_admin_audit_logs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            action VARCHAR(64) NOT NULL,
            job_name VARCHAR(128),
            execution_id VARCHAR(255),
            actor VARCHAR(128) NOT NULL DEFAULT 'admin',
            result VARCHAR(32) NOT NULL,
            metadata TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
          );

          CREATE INDEX IF NOT EXISTS scheduler_admin_audit_logs_action_idx 
            ON mitfloww.scheduler_admin_audit_logs (action);
          CREATE INDEX IF NOT EXISTS scheduler_admin_audit_logs_created_at_idx 
            ON mitfloww.scheduler_admin_audit_logs (created_at DESC);
        `);
        logger.info('[DatabaseClient] Verified "mitfloww" schema and scheduler tables (job_runs, failure_logs, admin_audit_logs).');
      } else {
        const tableCheck = await client.query<{ exists: boolean }>(`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'mitfloww' AND table_name = 'scheduler_job_runs'
          ) as exists;
        `);

        if (!tableCheck.rows[0]?.exists) {
          throw new Error(
            '[DatabaseClient] Fail-Closed: Table "mitfloww.scheduler_job_runs" does not exist and AUTO_CREATE_AUDIT_TABLE is false. Please apply migrations before starting the scheduler.'
          );
        }
        logger.info('[DatabaseClient] Verified existing scheduler tables (DDL auto-creation disabled).');
      }

      // 3. Purge old audit history & failure records beyond retention windows
      try {
        const purgeRuns = await client.query(
          `DELETE FROM mitfloww.scheduler_job_runs WHERE started_at < NOW() - ($1 || ' days')::INTERVAL`,
          [env.AUDIT_LOG_RETENTION_DAYS]
        );
        if ((purgeRuns.rowCount ?? 0) > 0) {
          logger.info(`[DatabaseClient] Purged ${purgeRuns.rowCount} historical job runs older than ${env.AUDIT_LOG_RETENTION_DAYS} days.`);
        }

        const purgeFailures = await client.query(
          `DELETE FROM mitfloww.scheduler_failure_logs WHERE created_at < NOW() - ($1 || ' days')::INTERVAL`,
          [env.FAILURE_LOG_RETENTION_DAYS]
        );
        if ((purgeFailures.rowCount ?? 0) > 0) {
          logger.info(`[DatabaseClient] Purged ${purgeFailures.rowCount} historical failure logs older than ${env.FAILURE_LOG_RETENTION_DAYS} days.`);
        }

        const purgeAudit = await client.query(
          `DELETE FROM mitfloww.scheduler_admin_audit_logs WHERE created_at < NOW() - ($1 || ' days')::INTERVAL`,
          [env.ADMIN_AUDIT_RETENTION_DAYS]
        );
        if ((purgeAudit.rowCount ?? 0) > 0) {
          logger.info(`[DatabaseClient] Purged ${purgeAudit.rowCount} historical admin audit records older than ${env.ADMIN_AUDIT_RETENTION_DAYS} days.`);
        }
      } catch (purgeErr) {
        logger.debug("[DatabaseClient] Non-fatal error during audit log cleanup", { error: purgeErr });
      }
    } finally {
      client.release();
    }
  }

  /**
   * Persists a structured failure log record with sensitive credential scrubbing.
   */
  async recordFailure(log: InsertFailureLog): Promise<void> {
    try {
      let metaStr: string | null = null;
      if (log.metadata) {
        metaStr = typeof log.metadata === "string" ? sanitizeString(log.metadata) : sanitizeString(JSON.stringify(log.metadata));
      }

      await this.db.insert(schema.schedulerFailureLogs).values({
        executionId: log.executionId || null,
        jobName: log.jobName,
        severity: log.severity || "error",
        errorCode: log.errorCode || null,
        errorMessage: sanitizeString(log.errorMessage, 1000) || "Unknown error",
        operation: log.operation || null,
        entityType: log.entityType || null,
        entityId: log.entityId || null,
        storageBucket: log.storageBucket || null,
        storageKey: log.storageKey ? sanitizeString(log.storageKey, 500) : null,
        retryable: log.retryable ?? false,
        attempt: log.attempt ?? 1,
        stackTrace: log.stackTrace ? sanitizeString(log.stackTrace, 3000) : null,
        metadata: metaStr,
      });
    } catch (err) {
      logger.debug("[DatabaseClient] Failed to insert failure log", { error: err });
    }
  }

  /**
   * Records an administrative action to the persistent audit log.
   */
  async recordAdminAudit(audit: InsertAdminAudit): Promise<void> {
    try {
      let metaStr: string | null = null;
      if (audit.metadata) {
        metaStr = typeof audit.metadata === "string" ? sanitizeString(audit.metadata) : sanitizeString(JSON.stringify(audit.metadata));
      }

      await this.db.insert(schema.schedulerAdminAuditLogs).values({
        action: audit.action,
        jobName: audit.jobName || null,
        executionId: audit.executionId || null,
        actor: audit.actor || "admin",
        result: audit.result,
        metadata: metaStr,
      });
    } catch (err) {
      logger.debug("[DatabaseClient] Failed to record admin audit", { error: err });
    }
  }

  /**
   * Paginated query for Job Execution History.
   */
  async getJobRuns(params: JobRunsQueryParams = {}) {
    const limit = Math.min(Math.max(params.limit || 25, 1), 100);
    const offset = Math.max(params.offset || 0, 0);

    const conditions = [];

    if (params.jobName && params.jobName !== "all") {
      conditions.push(eq(schema.schedulerJobRuns.jobName, params.jobName));
    }
    if (params.status && params.status !== "all") {
      conditions.push(eq(schema.schedulerJobRuns.status, params.status));
    }
    if (params.search && params.search.trim().length > 0) {
      const q = `%${params.search.trim()}%`;
      conditions.push(
        or(
          ilike(schema.schedulerJobRuns.executionId, q),
          ilike(schema.schedulerJobRuns.jobName, q),
          ilike(schema.schedulerJobRuns.errorMessage, q)
        )
      );
    }
    if (params.from) {
      conditions.push(gte(schema.schedulerJobRuns.startedAt, params.from));
    }
    if (params.to) {
      conditions.push(lte(schema.schedulerJobRuns.startedAt, params.to));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, totalResult] = await Promise.all([
      this.db
        .select()
        .from(schema.schedulerJobRuns)
        .where(whereClause)
        .orderBy(desc(schema.schedulerJobRuns.startedAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.schedulerJobRuns)
        .where(whereClause),
    ]);

    const total = totalResult[0]?.count ?? 0;
    return {
      items,
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
    };
  }

  /**
   * Fetches single run by execution ID.
   */
  async getJobRunByExecutionId(executionId: string) {
    const runs = await this.db
      .select()
      .from(schema.schedulerJobRuns)
      .where(eq(schema.schedulerJobRuns.executionId, executionId))
      .limit(1);
    return runs[0] || null;
  }

  /**
   * Paginated query for Persistent Failure Logs.
   */
  async getFailureLogs(params: FailureLogsQueryParams = {}) {
    const limit = Math.min(Math.max(params.limit || 25, 1), 100);
    const offset = Math.max(params.offset || 0, 0);

    const conditions = [];

    if (params.jobName && params.jobName !== "all") {
      conditions.push(eq(schema.schedulerFailureLogs.jobName, params.jobName));
    }
    if (params.severity && params.severity !== "all") {
      conditions.push(eq(schema.schedulerFailureLogs.severity, params.severity));
    }
    if (typeof params.retryable === "boolean") {
      conditions.push(eq(schema.schedulerFailureLogs.retryable, params.retryable));
    }
    if (params.search && params.search.trim().length > 0) {
      const q = `%${params.search.trim()}%`;
      conditions.push(
        or(
          ilike(schema.schedulerFailureLogs.executionId, q),
          ilike(schema.schedulerFailureLogs.jobName, q),
          ilike(schema.schedulerFailureLogs.errorMessage, q),
          ilike(schema.schedulerFailureLogs.errorCode, q),
          ilike(schema.schedulerFailureLogs.entityId, q)
        )
      );
    }
    if (params.from) {
      conditions.push(gte(schema.schedulerFailureLogs.createdAt, params.from));
    }
    if (params.to) {
      conditions.push(lte(schema.schedulerFailureLogs.createdAt, params.to));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, totalResult] = await Promise.all([
      this.db
        .select()
        .from(schema.schedulerFailureLogs)
        .where(whereClause)
        .orderBy(desc(schema.schedulerFailureLogs.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.schedulerFailureLogs)
        .where(whereClause),
    ]);

    const total = totalResult[0]?.count ?? 0;
    return {
      items,
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
    };
  }

  /**
   * Fetches single failure log by ID.
   */
  async getFailureLogById(id: string) {
    const logs = await this.db
      .select()
      .from(schema.schedulerFailureLogs)
      .where(eq(schema.schedulerFailureLogs.id, id))
      .limit(1);
    return logs[0] || null;
  }

  /**
   * Paginated query for Admin Audit Logs.
   */
  async getAdminAuditLogs(params: AdminAuditQueryParams = {}) {
    const limit = Math.min(Math.max(params.limit || 25, 1), 100);
    const offset = Math.max(params.offset || 0, 0);

    const conditions = [];

    if (params.action && params.action !== "all") {
      conditions.push(eq(schema.schedulerAdminAuditLogs.action, params.action));
    }
    if (params.result && params.result !== "all") {
      conditions.push(eq(schema.schedulerAdminAuditLogs.result, params.result));
    }
    if (params.jobName && params.jobName !== "all") {
      conditions.push(eq(schema.schedulerAdminAuditLogs.jobName, params.jobName));
    }
    if (params.search && params.search.trim().length > 0) {
      const q = `%${params.search.trim()}%`;
      conditions.push(
        or(
          ilike(schema.schedulerAdminAuditLogs.executionId, q),
          ilike(schema.schedulerAdminAuditLogs.jobName, q),
          ilike(schema.schedulerAdminAuditLogs.actor, q),
          ilike(schema.schedulerAdminAuditLogs.action, q)
        )
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [items, totalResult] = await Promise.all([
      this.db
        .select()
        .from(schema.schedulerAdminAuditLogs)
        .where(whereClause)
        .orderBy(desc(schema.schedulerAdminAuditLogs.createdAt))
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.schedulerAdminAuditLogs)
        .where(whereClause),
    ]);

    const total = totalResult[0]?.count ?? 0;
    return {
      items,
      total,
      limit,
      offset,
      hasMore: offset + items.length < total,
    };
  }

  /**
   * Fetches single admin audit log by ID.
   */
  async getAdminAuditLogById(id: string) {
    const logs = await this.db
      .select()
      .from(schema.schedulerAdminAuditLogs)
      .where(eq(schema.schedulerAdminAuditLogs.id, id))
      .limit(1);
    return logs[0] || null;
  }

  /**
   * Safely clears historical scheduler data and resets console metrics.
   * GUARANTEE: In-flight executions with status = 'running' are untouched
   * so currently running processes finish cleanly and background intervals continue.
   */
  async clearHistory(options: {
    clearRuns?: boolean;
    clearFailures?: boolean;
    clearAudit?: boolean;
    actor?: string;
  } = {}) {
    const client = await this.pool.connect();
    try {
      let deletedRuns = 0;
      let deletedFailures = 0;
      let deletedAudits = 0;

      // 1. Clear completed runs without affecting running jobs
      if (options.clearRuns !== false) {
        const resRuns = await client.query(
          `DELETE FROM mitfloww.scheduler_job_runs WHERE status != 'running'`
        );
        deletedRuns = resRuns.rowCount ?? 0;
      }

      // 2. Clear failure logs
      if (options.clearFailures !== false) {
        const resFailures = await client.query(
          `DELETE FROM mitfloww.scheduler_failure_logs`
        );
        deletedFailures = resFailures.rowCount ?? 0;
      }

      // 3. Clear admin audit logs if requested
      if (options.clearAudit === true) {
        const resAudit = await client.query(
          `DELETE FROM mitfloww.scheduler_admin_audit_logs`
        );
        deletedAudits = resAudit.rowCount ?? 0;
      }

      // Record a fresh admin audit entry for this reset action
      await this.recordAdminAudit({
        action: "clear_history",
        actor: options.actor || "admin",
        result: "success",
        metadata: {
          deletedRuns,
          deletedFailures,
          deletedAudits,
          preservedRunningJobs: true,
          clearedAt: new Date().toISOString(),
        },
      });

      return {
        deletedRuns,
        deletedFailures,
        deletedAudits,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Aggregates overall scheduler execution metrics from the database.
   */
  async getOverallMetrics() {
    try {
      const summaryResult = await this.db
        .select({
          totalExecutions: sql<number>`count(*)::int`,
          successExecutions: sql<number>`count(*) filter (where status = 'success')::int`,
          failedExecutions: sql<number>`count(*) filter (where status = 'failed')::int`,
          cancelledExecutions: sql<number>`count(*) filter (where status = 'cancelled')::int`,
          lockedExecutions: sql<number>`count(*) filter (where status = 'locked')::int`,
          totalScanned: sql<number>`coalesce(sum(records_scanned), 0)::int`,
          totalEligible: sql<number>`coalesce(sum(records_eligible), 0)::int`,
          totalProcessed: sql<number>`coalesce(sum(records_processed), 0)::int`,
          totalDeleted: sql<number>`coalesce(sum(records_deleted), 0)::int`,
          totalSkipped: sql<number>`coalesce(sum(records_skipped), 0)::int`,
          totalFailed: sql<number>`coalesce(sum(records_failed), 0)::int`,
          lastSuccessAt: sql<Date | null>`max(completed_at) filter (where status = 'success')`,
        })
        .from(schema.schedulerJobRuns);

      const failureCountResult = await this.db
        .select({
          totalFailures: sql<number>`count(*)::int`,
          unresolved24h: sql<number>`count(*) filter (where created_at >= now() - interval '24 hours')::int`,
        })
        .from(schema.schedulerFailureLogs);

      return {
        summary: summaryResult[0] || {
          totalExecutions: 0,
          successExecutions: 0,
          failedExecutions: 0,
          cancelledExecutions: 0,
          lockedExecutions: 0,
          totalScanned: 0,
          totalEligible: 0,
          totalProcessed: 0,
          totalDeleted: 0,
          totalSkipped: 0,
          totalFailed: 0,
          lastSuccessAt: null,
        },
        failures: failureCountResult[0] || {
          totalFailures: 0,
          unresolved24h: 0,
        },
      };
    } catch (err) {
      logger.error("[DatabaseClient] Error calculating metrics", { error: err });
      return {
        summary: {
          totalExecutions: 0,
          successExecutions: 0,
          failedExecutions: 0,
          cancelledExecutions: 0,
          lockedExecutions: 0,
          totalScanned: 0,
          totalEligible: 0,
          totalProcessed: 0,
          totalDeleted: 0,
          totalSkipped: 0,
          totalFailed: 0,
          lastSuccessAt: null,
        },
        failures: {
          totalFailures: 0,
          unresolved24h: 0,
        },
      };
    }
  }


  // ==========================================
  // Operational Logs Query & Persistence
  // ==========================================

  async queryLogs(params: ServiceLogsQueryParams): Promise<{ items: UnifiedLogItem[]; total: number }> {
    const limit = Math.min(Math.max(params.limit || 50, 1), 200);
    const offset = Math.max(params.offset || 0, 0);
    const service = params.service || "all";

    try {
      const conditions: string[] = [];
      const values: any[] = [];
      let idx = 1;

      if (params.level && params.level !== "all") {
        conditions.push(`level = ${idx++}`);
        values.push(params.level.toLowerCase());
      }

      if (params.from) {
        conditions.push(`timestamp >= ${idx++}`);
        values.push(params.from);
      }

      if (params.to) {
        conditions.push(`timestamp <= ${idx++}`);
        values.push(params.to);
      }

      if (params.requestId) {
        conditions.push(`request_id = ${idx++}`);
        values.push(params.requestId);
      }

      if (params.search) {
        conditions.push(`(message ILIKE ${idx} OR event ILIKE ${idx} OR coalesce(request_id, '') ILIKE ${idx} OR coalesce(user_id, '') ILIKE ${idx} OR coalesce(error_message, '') ILIKE ${idx})`);
        values.push(`%${params.search}%`);
        idx++;
      }

      const whereClause = conditions.length > 0 ? "WHERE " + conditions.join(" AND ") : "";

      let selectQueries: string[] = [];

      if (service === "api" || service === "all") {
        selectQueries.push(`
          SELECT id, 'api' AS service, timestamp, level, event, message, request_id, correlation_id, user_id, duration_ms, status_code, component, error_code, error_message, (stack_trace IS NOT NULL AND length(stack_trace) > 0) AS has_stack_trace, (metadata IS NOT NULL) AS has_metadata, created_at
          FROM mitfloww.api_logs ${whereClause}
        `);
      }

      if (service === "web" || service === "all") {
        selectQueries.push(`
          SELECT id, 'web' AS service, timestamp, level, event, message, request_id, NULL AS correlation_id, user_id, NULL::int AS duration_ms, status_code, component, NULL AS error_code, error_message, (stack_trace IS NOT NULL AND length(stack_trace) > 0) AS has_stack_trace, (metadata IS NOT NULL) AS has_metadata, created_at
          FROM mitfloww.web_logs ${whereClause}
        `);
      }

      if (service === "worker" || service === "all") {
        selectQueries.push(`
          SELECT id, 'worker' AS service, timestamp, level, event, message, job_id AS request_id, NULL AS correlation_id, NULL AS user_id, duration_ms, NULL::int AS status_code, stage AS component, NULL AS error_code, error_message, (stack_trace IS NOT NULL AND length(stack_trace) > 0) AS has_stack_trace, (metadata IS NOT NULL) AS has_metadata, created_at
          FROM mitfloww.worker_logs ${whereClause}
        `);
      }

      if (service === "scheduler" || service === "all") {
        selectQueries.push(`
          SELECT id, 'scheduler' AS service, timestamp, level, event, message, execution_id AS request_id, NULL AS correlation_id, NULL AS user_id, duration_ms, NULL::int AS status_code, job_name AS component, NULL AS error_code, error_message, (stack_trace IS NOT NULL AND length(stack_trace) > 0) AS has_stack_trace, (metadata IS NOT NULL) AS has_metadata, created_at
          FROM mitfloww.scheduler_logs ${whereClause}
        `);
      }

      const unionSql = selectQueries.join(" UNION ALL ");
      const finalSql = `
        WITH combined AS (
          ${unionSql}
        )
        SELECT * FROM combined
        ORDER BY timestamp DESC
        LIMIT ${idx++} OFFSET ${idx++};
      `;

      const countSql = `
        WITH combined AS (
          ${unionSql}
        )
        SELECT count(*)::int AS total FROM combined;
      `;

      const [rowsRes, countRes] = await Promise.all([
        this.pool.query(finalSql, [...values, limit, offset]),
        this.pool.query(countSql, values),
      ]);

      const items: UnifiedLogItem[] = rowsRes.rows.map((r: any) => ({
        id: Number(r.id),
        service: r.service,
        timestamp: new Date(r.timestamp),
        level: r.level,
        event: r.event,
        message: r.message,
        requestId: r.request_id || null,
        correlationId: r.correlation_id || null,
        userId: r.user_id || null,
        durationMs: r.duration_ms != null ? Number(r.duration_ms) : null,
        statusCode: r.status_code != null ? Number(r.status_code) : null,
        component: r.component || null,
        errorCode: r.error_code || null,
        errorMessage: r.error_message || null,
        hasStackTrace: Boolean(r.has_stack_trace),
        hasMetadata: Boolean(r.has_metadata),
        createdAt: new Date(r.created_at),
      }));

      const total = Number(countRes.rows[0]?.total || 0);

      return { items, total };
    } catch (err) {
      logger.error("[DatabaseClient] Error querying logs", { error: err });
      return { items: [], total: 0 };
    }
  }

  async getLogById(service: string, id: number): Promise<any | null> {
    const validTables: Record<string, string> = {
      api: "api_logs",
      web: "web_logs",
      worker: "worker_logs",
      scheduler: "scheduler_logs",
    };

    const tableName = validTables[service.toLowerCase()];
    if (!tableName) return null;

    try {
      const res = await this.pool.query(
        `SELECT * FROM mitfloww.${tableName} WHERE id = $1 LIMIT 1;`,
        [id]
      );
      if (res.rows.length === 0) return null;
      const row = res.rows[0];
      return {
        ...row,
        id: Number(row.id),
        service,
      };
    } catch (err) {
      logger.error("[DatabaseClient] Error getting log by id", { error: err, service, id });
      return null;
    }
  }

  async getLogStats(): Promise<Record<string, { total: number; errors: number }>> {
    try {
      const res = await this.pool.query(`
        SELECT 'api' AS service, count(*)::int AS total, count(*) FILTER (WHERE level IN ('error', 'fatal'))::int AS errors FROM mitfloww.api_logs WHERE timestamp >= NOW() - INTERVAL '24 hours'
        UNION ALL
        SELECT 'web' AS service, count(*)::int AS total, count(*) FILTER (WHERE level IN ('error', 'fatal'))::int AS errors FROM mitfloww.web_logs WHERE timestamp >= NOW() - INTERVAL '24 hours'
        UNION ALL
        SELECT 'worker' AS service, count(*)::int AS total, count(*) FILTER (WHERE level IN ('error', 'fatal'))::int AS errors FROM mitfloww.worker_logs WHERE timestamp >= NOW() - INTERVAL '24 hours'
        UNION ALL
        SELECT 'scheduler' AS service, count(*)::int AS total, count(*) FILTER (WHERE level IN ('error', 'fatal'))::int AS errors FROM mitfloww.scheduler_logs WHERE timestamp >= NOW() - INTERVAL '24 hours';
      `);

      const stats: Record<string, { total: number; errors: number }> = {};
      for (const row of res.rows) {
        stats[row.service] = { total: Number(row.total), errors: Number(row.errors) };
      }
      return stats;
    } catch (err) {
      logger.error("[DatabaseClient] Error getting log stats", { error: err });
      return {
        api: { total: 0, errors: 0 },
        web: { total: 0, errors: 0 },
        worker: { total: 0, errors: 0 },
        scheduler: { total: 0, errors: 0 },
      };
    }
  }

  async insertSchedulerLog(entry: {
    level: string;
    event: string;
    message: string;
    jobName?: string | null;
    executionId?: string | null;
    durationMs?: number | null;
    scanned?: number | null;
    processed?: number | null;
    deleted?: number | null;
    failed?: number | null;
    errorMessage?: string | null;
    stackTrace?: string | null;
    metadata?: any;
  }): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO mitfloww.scheduler_logs (
          level, event, message, job_name, execution_id, duration_ms, scanned, processed, deleted, failed, error_message, stack_trace, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13);`,
        [
          entry.level,
          entry.event,
          entry.message,
          entry.jobName || null,
          entry.executionId || null,
          entry.durationMs ?? null,
          entry.scanned ?? null,
          entry.processed ?? null,
          entry.deleted ?? null,
          entry.failed ?? null,
          entry.errorMessage || null,
          entry.stackTrace || null,
          entry.metadata ? JSON.stringify(entry.metadata) : null,
        ]
      );
    } catch (err) {
      // Non-blocking log insert failure isolation
    }
  }

  async purgeServiceLogs(service: string, retentionDays: number): Promise<number> {
    const validTables: Record<string, string> = {
      api: "api_logs",
      web: "web_logs",
      worker: "worker_logs",
      scheduler: "scheduler_logs",
    };
    const tableName = validTables[service.toLowerCase()];
    if (!tableName || retentionDays <= 0) return 0;

    try {
      const res = await this.pool.query(
        `DELETE FROM mitfloww.${tableName}
         WHERE timestamp < NOW() - ($1 || ' days')::INTERVAL;`,
        [retentionDays]
      );
      return res.rowCount || 0;
    } catch (err) {
      logger.error("[DatabaseClient] Error purging service logs", { error: err, service, retentionDays });
      return 0;
    }
  }

  async close(): Promise<void> {
    try {
      await this.pool.end();
      logger.info("[DatabaseClient] Connection pool drained and closed.");
    } catch (err) {
      logger.error("[DatabaseClient] Error closing database pool", { error: err });
    }
  }
}

export const dbClient = new DatabaseClient();
export const db = dbClient.db;
