# MitFloww Scheduler

Production-grade, extensible background scheduling and cleanup service for the MitFloww platform.

---

## 1. Overview & Architecture

The **MitFloww Scheduler** is a dedicated background service designed to automatically perform time-based lifecycle maintenance, object storage cleanup (Cloudflare R2), and database record pruning across the MitFloww ecosystem.

### Core Architectural Principles

1. **Continuous & Autonomous**: Runs as a daemon process with a central tick loop scheduling registered jobs at independent, configurable intervals.
2. **Defensive by Design**: Follows the strict rule that **false negatives are preferable to false positives for destructive cleanup**. If ownership, file state, or active processing cannot be definitively verified, the scheduler skips the item and logs the reason.
3. **Failure Isolation**: A failure in one job (e.g., an S3 timeout on expired projects) **never crashes the scheduler or prevents other jobs from running**. Each job runs within its own error boundary.
4. **Distributed Concurrency Protection**: Employs **PostgreSQL Advisory Locks** (`pg_try_advisory_lock`) using 64-bit bigint hashes of job keys. This guarantees that multiple scheduler instances running across containers or servers will never execute the same cleanup task concurrently. Locks automatically release upon completion, failure, or connection drop.
5. **Authoritative Rules Separation**:
   - **Database-authoritative**: Expiration dates, plan retention limits, user ownership, active processing states, and soft-delete timestamps are read directly from PostgreSQL.
   - **System-level configuration**: Batch sizes, polling intervals, safety grace periods, and account purge thresholds are configured via environment variables.
6. **Bounded Resource Consumption**: Uses keyset/cursor database pagination (`WHERE id > lastId ORDER BY id ASC LIMIT batchSize`) and chunked batch deletions (maximum 1,000 keys per S3 API request according to AWS/R2 specification) to maintain a minimal CPU and memory footprint, preventing performance degradation on co-located servers.
7. **Zero Magic Status Strings**: All status comparisons use strongly typed enum objects and DB integer constants (`ProjectStatusDb`, `FileUploadStatusDb`, `FileProcessingStatusDb`, `FileVersionReportStatusDb`, `AssetStatusDb`, `UserStatusDb`).

```
                          ┌───────────────────────────┐
                          │   Scheduler Daemon Loop   │
                          └─────────────┬─────────────┘
                                        │
                         ┌──────────────┴──────────────┐
                         │      Job Registry           │
                         └──────────────┬──────────────┘
                                        │ (Ticked per interval)
                         ┌──────────────┴──────────────┐
                         │   Distributed Lock Manager  │  (Postgres Advisory Locks)
                         └──────────────┬──────────────┘
                                        │
           ┌────────────────────────────┼────────────────────────────┐
           ▼                            ▼                            ▼
  [Expired Projects]           [Revision Lifecycle]          [Stale Uploads]
           │                            │                            │
           ▼                            ▼                            ▼
  [Orphaned Files]             [Soft-Deleted Assets]         [Deleted Users]
           │                            │                            │
           └────────────────────────────┼────────────────────────────┘
                                        │
                         ┌──────────────┴──────────────┐
                         ▼                             ▼
                 [PostgreSQL DB]               [Cloudflare R2]
            (Metadata & Authoritative)       (Batch Object Deletion)
```

---


---

## 2. Advanced Safety & Concurrency Architecture

### 2.1 Keyset / Cursor Pagination Strategy
Every cleanup job in MitFloww Scheduler strictly avoids `OFFSET` pagination for database record traversal. Because cleanup operations mutate or delete candidate records, traditional `LIMIT/OFFSET` causes severe **row-drift**:
- As earlier rows are deleted or updated, the table shifts upwards, causing the next `OFFSET` offset to skip records.
- In large tables, high `OFFSET` values force the database engine to scan and discard thousands of records.

Instead, the scheduler uses deterministic primary-key keyset pagination:
```sql
SELECT ... FROM table
WHERE id > $lastSeenId
  AND [eligibility_conditions]
ORDER BY id ASC
LIMIT $batchSize;
```
Each batch processes records, advances the `cursor = batch[batch.length - 1].id`, and continues until an empty batch is returned or an emergency stop condition is met. This guarantees constant-time ($O(1)$) seek performance and completely prevents skipped or double-processed records.

### 2.2 Crash-Resilient 5-Stage Deleted-User Cleanup
The `deleted-users` job operates under the premise that the scheduler process, container, or server can crash at any point (e.g. after deleting 10% of files, or during an S3 API call). To guarantee complete idempotency without orphan creation, permanent user purging is executed in 5 isolated, resumable phases:
1. **Phase 1: Project Purge**: For every project belonging to the user, batch-deletes all R2 objects under `users/<userId>/projects/<projectId>/` and deletes database project records.
2. **Phase 2: Asset Purge**: Collects and batch-deletes all R2 asset files and preview keys under `assets/` and `asset-previews/`, cascading database records.
3. **Phase 3: Brand & Avatar Purge**: Cleans the user's uploaded avatar image and company brand logo from R2.
4. **Phase 4: Full User R2 Prefix Purge**: Strict format validation ensures `userId` matches `/^[a-zA-Z0-9_\-]+$/` and contains no relative path markers (`..`, `/`, `\\`). Only upon successful validation is a paged scan and batch deletion executed under `users/<userId>/`.
5. **Phase 5: Database Profile Purge**: Hard-deletes the user's row in `mitfloww.users`, completing the purge.

If the process crashes during any phase, the next scheduler execution resumes seamlessly because stages 1-4 are completely idempotent, and the user record remains marked as deleted in the database until Phase 5 finishes.

### 2.3 R2 Orphan Detection & Worker Race Elimination
For `orphaned-processed-files` and all object storage cleanup:
1. **Ownership Established**: Target storage keys must belong to recognized MitFloww storage namespaces and buckets.
2. **Active Processing Protection**: File versions with status `PENDING`, `UPLOADING`, `PROCESSING`, or `COMPLETED` are strictly protected. Only files definitively in `FAILED`, `CANCELLED`, or `CORRUPT` qualify.
3. **Zero-Guessing Principle**: An object being old is **never** by itself sufficient for deletion. If database ownership or state cannot be proven, the scheduler logs a warning and **SKIPS** the item.
4. **Atomic Claim to Eliminate Worker Race Condition**:
   - If a transcode worker retries a failed file concurrently, the worker updates the record's `processing_status` and `updated_at`.
   - The scheduler executes an **atomic conditional update** in PostgreSQL prior to R2 deletion:
     ```sql
     UPDATE mitfloww.file_versions
     SET processed_storage_key = NULL, updated_at = NOW()
     WHERE id = $id
       AND processing_status IN (Failed, Cancelled, Corrupt)
       AND updated_at <= $thresholdDate;
     ```
   - If the update affects 0 rows (meaning a worker touched or retried the file), the scheduler **immediately aborts R2 deletion**, eliminating destructive race conditions.

### 2.4 PostgreSQL Advisory Locking & Multi-Instance Safety
The scheduler uses PostgreSQL session-level advisory locks via `pg_try_advisory_lock(bigint)`:
- Job keys (e.g. `scheduler:expired-projects`) are hashed using a 64-bit BigInt algorithm into Postgres-compatible signed 64-bit integers.
- Locks are acquired on a dedicated session connection before job execution.
- If another scheduler container holds the lock, `pg_try_advisory_lock` returns `false` instantly, and the job is cleanly skipped without blocking.
- Locks are strictly released in a `finally` block. If a node crashes, PostgreSQL automatically releases all session-level locks upon connection termination.
- Statement timeouts (default 10s) prevent lock acquisition queries from hanging indefinitely.

### 2.5 Persistent Job History Table & Retention (`mitfloww.scheduler_job_runs`)
All job runs record their execution lifecycle and metrics into the PostgreSQL `mitfloww.scheduler_job_runs` audit table using strongly typed statuses (`SchedulerJobStatus.Running`, `Success`, `Failed`, `Locked`):
- **Controlled DDL Deployment**: Controlled via `AUTO_CREATE_AUDIT_TABLE=true` (default). In environments where DDL is restricted to migration pipelines, setting `AUTO_CREATE_AUDIT_TABLE=false` forces fail-closed verification that the table exists without attempting DDL.
- **Audit Table Pruning**: On startup and regular intervals, the scheduler automatically purges historical audit records older than `AUDIT_LOG_RETENTION_DAYS` (default 30 days) to prevent unbounded table growth.
- **Sanitized Logging**: Error messages and JSON details are truncated and sanitized to guarantee that database passwords or auth bearer tokens are never leaked into the audit table.
```sql
CREATE TABLE IF NOT EXISTS mitfloww.scheduler_job_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name text NOT NULL,
  execution_id text NOT NULL,
  started_at timestamp with time zone NOT NULL,
  completed_at timestamp with time zone,
  duration_ms integer,
  status text NOT NULL, -- 'running' | 'success' | 'failed'
  records_scanned integer DEFAULT 0,
  records_eligible integer DEFAULT 0,
  records_processed integer DEFAULT 0,
  records_deleted integer DEFAULT 0,
  records_skipped integer DEFAULT 0,
  records_failed integer DEFAULT 0,
  error_message text,
  metadata jsonb
);
```
This provides production observability, audit trails, and troubleshooting visibility.

## 3. Implemented Cleanup Jobs

| Job Name | Default Schedule | Responsibility & Scope |
| :--- | :--- | :--- |
| **`expired-projects`** | Every 15 min | Identifies projects whose database expiry date has passed (`shareExpiresAt <= now`) or soft-deleted projects. Verifies no active uploads or worker transcoding are in progress, batch deletes all project R2 files (original, preview, processed, worker logs) under `users/<userId>/projects/<projectId>/`, and marks records purged. |
| **`revision-lifecycle`** | Every 1 hour | Scans for expired revision previews (`previewRetentionUntil <= now`) and deletes their R2 preview artifacts. Cleans up old resolved file reports past `RESOLVED_REPORT_RETENTION_DAYS`. |
| **`stale-uploads`** | Every 30 min | Identifies abandoned R2 multipart uploads initiated before `STALE_UPLOAD_RETENTION_HOURS` (default 24h) and aborts them via `AbortMultipartUploadCommand`. Marks stale uploading DB records with no completed versions as Failed. |
| **`orphaned-processed-files`**| Every 2 hours | Scans for worker processing artifacts in R2 whose file version status is definitively Failed or Cancelled beyond `ORPHANED_FILE_RETENTION_HOURS`. Verifies no active version references the key before deletion. |
| **`soft-deleted-assets`** | Every 1 hour | Finds soft-deleted creator assets past `SOFT_DELETED_ASSET_RETENTION_DAYS` (default 14 days), batch deletes all associated R2 files and previews, and cascades permanent deletion in the database. |
| **`deleted-users`** | Every 6 hours | **Case 1 (< 30 days)**: If an account was deleted but is within retention, checks if its projects reached normal expiration and cleans project R2 files while preserving account profile. <br>**Case 2 (>= 30 days)**: Full permanent purge of all user data, assets, project files, avatar, company logo, and the entire user R2 prefix (`users/<userId>/`). |

---

## 4. Extensible Job Architecture: Adding a New Job

Adding a new cleanup or maintenance job requires zero modifications to existing jobs:

### Step 1: Create the Service and Job Class

Create a new directory `src/jobs/my-custom-cleanup/`:

```ts
// src/jobs/my-custom-cleanup/my-custom-cleanup.service.ts
import type { DatabaseClient } from "../../database/client.js";
import type { R2Cleaner } from "../../storage/r2-cleaner.js";
import type { JobContext, JobResult } from "../../core/job.interface.js";

export class MyCustomCleanupService {
  constructor(
    private dbClient: DatabaseClient,
    private r2Cleaner: R2Cleaner
  ) {}

  async processCleanup(ctx: JobContext): Promise<JobResult> {
    const result: JobResult = {
      scanned: 0,
      eligible: 0,
      processed: 0,
      deleted: 0,
      skipped: 0,
      failed: 0,
    };

    // 1. Query candidate records
    // 2. Perform safety checks
    // 3. Delete R2 objects via this.r2Cleaner.deleteObjects()
    // 4. Update or purge DB records

    return result;
  }
}
```

```ts
// src/jobs/my-custom-cleanup/my-custom-cleanup.job.ts
import type { JobContext, JobResult, SchedulerJob } from "../../core/job.interface.js";
import type { MyCustomCleanupService } from "./my-custom-cleanup.service.js";

export class MyCustomCleanupJob implements SchedulerJob {
  readonly name = "my-custom-cleanup";
  readonly description = "Cleans up custom temporary resources";
  readonly intervalMs = 30 * 60 * 1000; // Run every 30 minutes
  readonly initialDelayMs = 10000;      // 10s initial delay after startup

  constructor(private service: MyCustomCleanupService) {}

  async execute(ctx: JobContext): Promise<JobResult> {
    return await this.service.processCleanup(ctx);
  }
}
```

### Step 2: Register in `src/index.ts`

```ts
const myCustomService = new MyCustomCleanupService(dbClient, r2Cleaner);
registry.register(new MyCustomCleanupJob(myCustomService));
```

---

## 5. Configuration Reference

Copy `.env.example` to `.env` and configure:

| Variable | Description | Default / Recommended |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:pw@127.0.0.1:5432/mitfloww` |
| `DB_POOL_MIN` / `DB_POOL_MAX` | Database pool size boundaries | `1` / `5` |
| `R2_ACCOUNT_ID` | Cloudflare Account ID | Set from Cloudflare dashboard |
| `R2_ACCESS_KEY_ID` | R2 Access Key ID | Set from Cloudflare dashboard |
| `R2_SECRET_ACCESS_KEY` | R2 Secret Access Key | Set from Cloudflare dashboard |
| `R2_BUCKET_NAME` | Primary bucket for deliverables and projects | `mitfloww-files` |
| `ASSETS_BUCKET_NAME` | Bucket for creator digital assets | `mitfloww-assets` |
| `SCHEDULER_ENABLED` | Master toggle to enable/disable scheduler loop | `true` |
| `DRY_RUN` | When true, logs destructive actions without mutating R2 or DB | `false` |
| `SCHEDULER_BATCH_SIZE` | Maximum number of items scanned per job tick | `100` |
| `ACCOUNT_DELETION_RETENTION_DAYS` | Grace period before permanent user purge | `30` |
| `STALE_UPLOAD_RETENTION_HOURS` | Grace period before aborting unfinished uploads | `24` |
| `ORPHANED_FILE_RETENTION_HOURS` | Grace period before cleaning failed processing files | `48` |
| `SOFT_DELETED_ASSET_RETENTION_DAYS`| Grace period before purging soft-deleted assets | `14` |
| `HEALTH_SERVER_PORT` | Port for internal HTTP health check probe | `4002` |

---

## 6. Development & Local Run

```bash
# 1. Install dependencies
pnpm install

# 2. Run in development mode with auto-reload
pnpm dev

# 3. Type check
pnpm typecheck

# 4. Run automated test suite
pnpm test

# 5. Build production bundle
pnpm build

# 6. Start production build
pnpm start
```

---

## 7. Health & Observability

The scheduler includes a built-in lightweight HTTP health probe on port `4002`:

- `GET /health` or `GET /live`: Returns HTTP `200 OK` with JSON payload containing uptime, database connectivity, R2 connectivity, and recent execution metrics for each job.
- `GET /ready`: Returns HTTP `200` if both database and storage connections are healthy, or HTTP `503` if any connection is lost.

Sample health response:
```json
{
  "status": "healthy",
  "uptimeSeconds": 1420,
  "database": "connected",
  "storage": "connected",
  "timestamp": "2026-09-27T15:00:00.000Z",
  "jobs": {
    "expired-projects": {
      "name": "expired-projects",
      "lastRunAt": "2026-09-27T14:45:00.000Z",
      "lastCompletedAt": "2026-09-27T14:45:02.120Z",
      "lastDurationMs": 2120,
      "lastStatus": "success",
      "lastError": null,
      "lastResult": {
        "scanned": 12,
        "eligible": 3,
        "processed": 3,
        "deleted": 18,
        "skipped": 9,
        "failed": 0
      },
      "consecutiveFailures": 0
    }
  }
}
```

---

## 8. Docker Deployment

Build and run as a standalone container:

```bash
# Build Docker image
docker build -t mitfloww-scheduler .

# Run container
docker run -d \
  --name mitfloww-scheduler \
  --restart unless-stopped \
  --env-file .env \
  -p 4002:4002 \
  mitfloww-scheduler
```

---

## 9. Failure Recovery Scenarios

---

## 10. Staging Deployment Runbook & Operational Guide

### 10.1 Schema Management Strategy
- **Local Development**: Keep `AUTO_CREATE_AUDIT_TABLE=true` in `.env`. The scheduler will automatically provision `mitfloww.scheduler_job_runs` on boot.
- **Production & Staging**: Set `AUTO_CREATE_AUDIT_TABLE=false`. Manage schemas via MitFloww's migration pipeline:
  ```bash
  # Inside E:\MitFloww\api
  pnpm drizzle-kit migrate
  # (Executes drizzle/0040_scheduler_job_runs_and_cleanup_indexes.sql)
  ```
  This prevents background worker processes from executing uncoordinated DDL against production databases.

### 10.2 First Run Safety Protocol (Historical Backlog Handling)
> [!CAUTION]
> **CRITICAL PRODUCTION WARNING**: When deploying the scheduler against an existing database for the first time, there may be months of unpurged expired projects, abandoned uploads, and soft-deleted assets.
> **DO NOT start the scheduler with `DRY_RUN=false` on first deployment.**

Follow this phased deployment sequence:
1. **Prepare Environment**: Copy `.env.example` to `.env`. Set `DRY_RUN=true`.
2. **Apply Database Migration**: Apply migration `0040_scheduler_job_runs_and_cleanup_indexes.sql` from `api/drizzle/`.
3. **Configure Object Storage**: Set production `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` (`mitfloww-files`), and `ASSETS_BUCKET_NAME` (`mitfloww-assets`).
4. **Boot in Simulation Mode**: Start the service with `pnpm start` or Docker.
5. **Inspect Live Health Probe**: Request `curl http://localhost:4002/health`.
6. **Audit Candidate Logs**: Review the structured logs. Verify the `scanned` and `eligible` counts for:
   - `expired-projects`
   - `deleted-users`
   - `soft-deleted-assets`
   - `stale-uploads`
   - `orphaned-processed-files`
   - `revision-lifecycle`
7. **Verify Persistent Audit Table**: Query `mitfloww.scheduler_job_runs` to inspect historical run durations and records.
8. **Confirm Eligibility**: Spot-check 2–3 sample project and asset IDs reported in logs to confirm they are indeed expired.
9. **Enable Destructive Mode**: Update `.env` to `DRY_RUN=false` and restart the scheduler service.
10. **Monitor Post-Cutover Metrics**: Watch `GET /health` for consecutive failures or S3 rate limits.


- **R2 Unreachable**: If Cloudflare R2 is temporarily unavailable or returns rate limits, the operation catches the error, retries with exponential backoff up to `DEFAULT_MAX_RETRIES`, logs the failure, and gracefully skips to the next item. On the next scheduled run, the item is safely picked up again.
- **Database Connection Lost**: The database connection pool automatically reconnects. If a query fails, the current job records a failure and releases its advisory lock. The health probe transitions to `unhealthy` (HTTP 503) so orchestrators can restart or route alerts.
- **Process Crash / Container Restart**: Session-scoped PostgreSQL advisory locks are automatically freed by PostgreSQL upon connection disconnect. No stuck or orphaned locks remain. Cleanup restarts from the last committed database state cleanly.

---

## 5. Scheduler Operations & Admin Console (Internal Ops UI)

The scheduler includes an **internal, standalone operations console** and REST API served directly on the scheduler's HTTP server (port `4002`).

> **Note**: This is an internal operations tool for administrators and operators. It is completely standalone inside the scheduler service and is **not** part of the customer-facing MitFloww web application.

### 5.1 Console Features

- **Real-Time Dashboard**:
  - Live scheduler health status (Healthy / Degraded / Paused / Stopped), uptime counter, and database/storage connectivity indicators.
  - `DRY RUN (ENFORCED)` vs `DESTRUCTIVE MODE` environment safety banner.
  - Overall execution metrics (Total Runs, Success Rate, Failed Runs, Cancelled Aborts, Records Scanned, Processed, Deleted, Skipped, Failed).
  - Live In-Flight / Active Jobs table with cooperative cancel controls.
- **Jobs & Controls**:
  - Full catalog of all registered cleanup jobs with descriptions, schedules, statuses, and last run statistics.
  - **Manual "Run Now"**: Triggers immediate job execution through the standard `JobRunner` with full distributed locking, retry handling, and audit recording.
  - **Cooperative Cancellation**: Dispatches an `AbortSignal` to active jobs, releasing advisory locks and database connections cleanly.
  - **Pause / Resume**: Suspends upcoming scheduled ticks without terminating in-flight jobs.
- **Authoritative Execution History**:
  - Paginated, filterable table powered by `mitfloww.scheduler_job_runs`.
  - Filters by job name, status, date range, and search by execution ID.
  - Detailed execution modal with complete metrics breakdown and sanitized error details.
- **Persistent Failure Logs**:
  - Dedicated table `mitfloww.scheduler_failure_logs` for recording operational exceptions with error codes, entity references, and sanitized stack traces.
  - Built-in "Test Ingestion" trigger for verification testing.
- **Administrative Audit Trail**:
  - Dedicated table `mitfloww.scheduler_admin_audit_logs` recording every manual trigger, cancellation, pause/resume, and login.

### 5.2 Accessing the Operations Console

1. Start the scheduler service:
   ```bash
   cd scheduler
   pnpm dev
   ```
2. Open your browser and navigate to:
   [http://localhost:4002/](http://localhost:4002/) (or [http://localhost:4002/admin](http://localhost:4002/admin))
3. Log in using the administrative key configured in `.env` (`SCHEDULER_ADMIN_KEY`, default: `mitfloww-admin-secret`).

### 5.3 Operations REST API Endpoints

| Method | Path | Auth Required | Description |
|---|---|:---:|---|
| `GET` | `/health` | No | Standard health probe for load balancers and orchestrators |
| `GET` | `/ready` | No | Readiness probe (verifies PostgreSQL and R2 connectivity) |
| `GET` | `/api/auth/check` | No | Checks current session status and environment mode |
| `POST` | `/api/auth/login` | No | Authenticates admin key and sets secure session cookie |
| `POST` | `/api/auth/logout` | Yes | Clears session cookie |
| `GET` | `/api/scheduler/status` | Yes | Returns overall health, metrics, uptime, and active executions |
| `GET` | `/api/scheduler/metrics` | Yes | Aggregated execution and failure metrics from database |
| `POST` | `/api/scheduler/pause` | Yes | Pauses scheduler loop (audited) |
| `POST` | `/api/scheduler/resume` | Yes | Resumes scheduler loop (audited) |
| `GET` | `/api/jobs` | Yes | Lists all registered cleanup jobs and active state |
| `GET` | `/api/jobs/:jobName` | Yes | Returns job details and 10 most recent execution runs |
| `POST` | `/api/jobs/:jobName/run` | Yes | Manually triggers job execution via `JobRunner` (audited) |
| `GET` | `/api/runs` | Yes | Paginated query on `scheduler_job_runs` (supports filtering) |
| `GET` | `/api/runs/:executionId` | Yes | Full execution run details |
| `POST` | `/api/runs/:executionId/cancel` | Yes | Cooperatively cancels active execution (audited) |
| `GET` | `/api/failures` | Yes | Paginated query on `scheduler_failure_logs` |
| `GET` | `/api/failures/:id` | Yes | Single failure log record |
| `GET` | `/api/audit-logs` | Yes | Paginated administrative action audit trail |
| `POST` | `/api/test/failure` | Yes | Generates a controlled test failure log for verification |

### 5.4 Authentication Methods

All protected `/api/*` endpoints accept authentication via:
1. **HTTP Bearer Token**: `Authorization: Bearer <SCHEDULER_ADMIN_KEY>`
2. **Custom Header**: `x-scheduler-key: <SCHEDULER_ADMIN_KEY>`
3. **Session Cookie**: `scheduler_admin_token=<SCHEDULER_ADMIN_KEY>` (auto-set upon web UI login)
