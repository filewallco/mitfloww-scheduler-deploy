import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import * as schema from "./schema.js";

const { Pool } = pg;

export class DatabaseClient {
  private pool: pg.Pool;
  public readonly db: ReturnType<typeof drizzle<typeof schema>>;

  constructor() {
    this.pool = new Pool({
      connectionString: env.DATABASE_URL,
      min: env.DB_POOL_MIN,
      max: env.DB_POOL_MAX,
      idleTimeoutMillis: env.DB_IDLE_TIMEOUT_MS,
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
   * If AUTO_CREATE_AUDIT_TABLE is true, ensures scheduler_job_runs table exists.
   * Otherwise verifies it exists without performing DDL.
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

      // 2. Scheduler audit table handling
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
        `);
        logger.info('[DatabaseClient] Verified "mitfloww" schema and "scheduler_job_runs" audit table.');
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
        logger.info('[DatabaseClient] Verified existing "scheduler_job_runs" audit table (DDL auto-creation disabled).');
      }

      // 3. Purge old audit history records beyond retention window
      try {
        const purgeRes = await client.query(
          `DELETE FROM mitfloww.scheduler_job_runs WHERE started_at < NOW() - ($1 || ' days')::INTERVAL`,
          [env.AUDIT_LOG_RETENTION_DAYS]
        );
        if ((purgeRes.rowCount ?? 0) > 0) {
          logger.info(`[DatabaseClient] Purged ${purgeRes.rowCount} historical audit records older than ${env.AUDIT_LOG_RETENTION_DAYS} days.`);
        }
      } catch (purgeErr) {
        logger.debug("[DatabaseClient] Non-fatal error during audit log cleanup", { error: purgeErr });
      }
    } finally {
      client.release();
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
