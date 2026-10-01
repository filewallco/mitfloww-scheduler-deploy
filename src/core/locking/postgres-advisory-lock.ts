import crypto from "node:crypto";
import type pg from "pg";
import type { DistributedLock, DistributedLockProvider } from "./lock.interface.js";
import { logger } from "../../utils/logger.js";

/**
 * Computes a stable 64-bit signed integer hash from a string key.
 * PostgreSQL advisory locks take either one 64-bit bigint or two 32-bit integers.
 */
export function hashLockKeyToBigInt(key: string): string {
  const hash = crypto.createHash("sha256").update(key).digest("hex");
  // Take 15 hex chars (60 bits) so it fits comfortably within positive signed 64-bit int (max 63 bits)
  const hex60 = hash.slice(0, 15);
  const num = BigInt("0x" + hex60);
  return num.toString();
}

export class PostgresAdvisoryLockProvider implements DistributedLockProvider {
  constructor(private pool: pg.Pool) {}

  async acquire(lockKey: string): Promise<DistributedLock | null> {
    const lockId = hashLockKeyToBigInt(lockKey);
    let client: pg.PoolClient | null = null;

    try {
      client = await this.pool.connect();

      // Prevent unhandled error event from crashing process if Neon/Postgres terminates idle connection
      if (typeof (client as any).on === "function") {
        (client as any).on("error", (clientErr: any) => {
          logger.warn("[PostgresLock] Lock client socket closed by server", { lockKey, error: clientErr?.message || String(clientErr) });
        });
      }

      // Set a short statement timeout on lock check so connection won't hang if pool is busy
      await client.query("SET statement_timeout = 5000");

      const res = await client.query<{ pg_try_advisory_lock: boolean }>(
        "SELECT pg_try_advisory_lock($1) as pg_try_advisory_lock",
        [lockId]
      );

      const acquired = Boolean(res.rows[0]?.pg_try_advisory_lock);

      if (!acquired) {
        client.release();
        return null;
      }

      // Reset statement timeout back to default for safety
      await client.query("SET statement_timeout = 0");

      const activeClient = client;
      let released = false;

      return {
        key: lockKey,
        acquiredAt: new Date(),
        release: async () => {
          if (released) return;
          released = true;
          try {
            await activeClient.query("SELECT pg_advisory_unlock($1)", [lockId]);
          } catch (err) {
            logger.warn("[PostgresLock] Error unlocking advisory lock", { lockKey, error: err });
          } finally {
            try {
              activeClient.release();
            } catch (relErr) {
              logger.debug("[PostgresLock] Client already released", { error: relErr });
            }
          }
        },
      };
    } catch (err) {
      if (client) {
        try { client.release(); } catch {}
      }
      logger.error("[PostgresLock] Failed to attempt advisory lock acquisition", { lockKey, error: err });
      return null;
    }
  }
}
