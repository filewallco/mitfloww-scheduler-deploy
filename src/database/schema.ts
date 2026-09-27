import {
  pgSchema,
  uuid,
  varchar,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  smallint,
  jsonb,
} from "drizzle-orm/pg-core";

export const fw = pgSchema("mitfloww");

// Projects Table
export const projects = fw.table("projects", {
  id: uuid("id").primaryKey(),
  publicId: varchar("public_id", { length: 255 }).notNull(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  title: varchar("title", { length: 80 }).notNull(),
  status: smallint("status").notNull(),
  shareExpiresAt: timestamp("share_expires_at", { withTimezone: true, mode: "date" }),
  paymentStatus: smallint("payment_status").notNull(),
  clientPaymentCompletedAt: timestamp("client_payment_completed_at", { withTimezone: true, mode: "date" }),
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
});

// Files Table
export const files = fw.table("files", {
  id: uuid("id").primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  name: varchar("name", { length: 120 }).notNull(),
  storageKey: text("storage_key").notNull(),
  storageBucket: varchar("storage_bucket", { length: 128 }).notNull().default("files"),
  currentVersionId: uuid("current_version_id"),
  approvalStatus: smallint("approval_status").notNull(),
  uploadStatus: smallint("upload_status").notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
});

// File Versions Table
export const fileVersions = fw.table("file_versions", {
  id: uuid("id").primaryKey(),
  fileId: uuid("file_id").notNull().references(() => files.id),
  revisionNumber: integer("revision_number").notNull(),
  originalName: varchar("original_name", { length: 255 }).notNull(),
  storageBucket: varchar("storage_bucket", { length: 128 }).notNull(),
  storageKey: text("storage_key").notNull(),
  processedStorageBucket: varchar("processed_storage_bucket", { length: 128 }),
  processedStorageKey: text("processed_storage_key"),
  previewRetentionUntil: timestamp("preview_retention_until", { withTimezone: true, mode: "date" }),
  previewPurgedAt: timestamp("preview_purged_at", { withTimezone: true, mode: "date" }),
  previewStorageBucket: varchar("preview_storage_bucket", { length: 128 }),
  previewStorageKey: text("preview_storage_key"),
  processingStatus: smallint("processing_status").notNull(),
  processingJobId: varchar("processing_job_id", { length: 128 }),
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
});

// File Version Reports Table
export const fileVersionReports = fw.table("file_version_reports", {
  id: uuid("id").primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  fileId: uuid("file_id").notNull().references(() => files.id),
  fileVersionId: uuid("file_version_id").notNull().references(() => fileVersions.id),
  status: smallint("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
});

// Revision Comments Table
export const revisionComments = fw.table("revision_comments", {
  id: uuid("id").primaryKey(),
  fileId: uuid("file_id").notNull().references(() => files.id),
  fileVersionId: uuid("file_version_id").notNull().references(() => fileVersions.id),
  projectId: uuid("project_id").notNull().references(() => projects.id),
  status: smallint("status").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
});

// Assets Table
export const assets = fw.table("assets", {
  id: uuid("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  title: varchar("title", { length: 120 }).notNull(),
  status: smallint("status").notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
});

// Asset Files Table
export const assetFiles = fw.table("asset_files", {
  id: uuid("id").primaryKey(),
  assetId: uuid("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
  storageKey: text("storage_key").notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
});

// Asset Preview Files Table
export const assetPreviewFiles = fw.table("asset_preview_files", {
  id: uuid("id").primaryKey(),
  assetId: uuid("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
  storageKey: text("storage_key").notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
});

// Asset Purchases Table
export const assetPurchases = fw.table("asset_purchases", {
  id: uuid("id").primaryKey(),
  assetId: uuid("asset_id").notNull().references(() => assets.id, { onDelete: "cascade" }),
  buyerEmail: varchar("buyer_email", { length: 255 }).notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true, mode: "date" }).notNull(),
});

// Users Table
export const users = fw.table("users", {
  id: varchar("id", { length: 255 }).primaryKey(),
  email: varchar("email", { length: 255 }),
  avatarStorageKey: varchar("avatar_storage_key", { length: 1024 }),
  status: smallint("status").notNull(),
  planKey: varchar("plan_key", { length: 50 }).notNull().default("free"),
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
});

// Companies Table
export const companies = fw.table("companies", {
  id: uuid("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  logoStorageKey: varchar("logo_storage_key", { length: 1024 }),
  deletedAt: timestamp("deleted_at", { withTimezone: true, mode: "date" }),
});

// Credit Accounts Table
export const creditAccounts = fw.table("credit_accounts", {
  id: uuid("id").primaryKey(),
  ownerUserId: varchar("owner_user_id", { length: 255 }).notNull(),
  planKey: varchar("plan_key", { length: 64 }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
});

// Storage Accounts Table
export const storageAccounts = fw.table("storage_accounts", {
  id: uuid("id").primaryKey(),
  ownerUserId: varchar("owner_user_id", { length: 255 }).notNull(),
  usedBytes: bigint("used_bytes", { mode: "number" }).notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull(),
});

// Sessions Table
export const sessions = fw.table("sessions", {
  id: uuid("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
});

// Auth Identities Table
export const authIdentities = fw.table("auth_identities", {
  id: uuid("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
});

// OTP Challenges Table
export const otpChallenges = fw.table("otp_challenges", {
  id: uuid("id").primaryKey(),
  userId: varchar("user_id", { length: 255 }).notNull(),
});

// Persistent Scheduler Job Execution History Table
export const schedulerJobRuns = fw.table("scheduler_job_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  executionId: varchar("execution_id", { length: 255 }).notNull(),
  jobName: varchar("job_name", { length: 128 }).notNull(),
  status: varchar("status", { length: 32 }).notNull(), // "running", "success", "failed", "locked"
  startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true, mode: "date" }),
  durationMs: integer("duration_ms"),
  recordsScanned: integer("records_scanned").notNull().default(0),
  recordsEligible: integer("records_eligible").notNull().default(0),
  recordsProcessed: integer("records_processed").notNull().default(0),
  recordsDeleted: integer("records_deleted").notNull().default(0),
  recordsSkipped: integer("records_skipped").notNull().default(0),
  recordsFailed: integer("records_failed").notNull().default(0),
  errorMessage: text("error_message"),
  details: text("details"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

// Persistent Scheduler Failure Logs Table
export const schedulerFailureLogs = fw.table("scheduler_failure_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  executionId: varchar("execution_id", { length: 255 }),
  jobName: varchar("job_name", { length: 128 }).notNull(),
  severity: varchar("severity", { length: 32 }).notNull().default("error"), // 'error', 'warn', 'fatal'
  errorCode: varchar("error_code", { length: 64 }),
  errorMessage: text("error_message").notNull(),
  operation: varchar("operation", { length: 128 }),
  entityType: varchar("entity_type", { length: 64 }),
  entityId: varchar("entity_id", { length: 255 }),
  storageBucket: varchar("storage_bucket", { length: 128 }),
  storageKey: text("storage_key"),
  retryable: boolean("retryable").notNull().default(false),
  attempt: integer("attempt").notNull().default(1),
  stackTrace: text("stack_trace"),
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

// Administrative Audit Logs Table
export const schedulerAdminAuditLogs = fw.table("scheduler_admin_audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  action: varchar("action", { length: 64 }).notNull(), // 'run_job', 'cancel_job', 'pause_scheduler', 'resume_scheduler'
  jobName: varchar("job_name", { length: 128 }),
  executionId: varchar("execution_id", { length: 255 }),
  actor: varchar("actor", { length: 128 }).notNull().default("admin"),
  result: varchar("result", { length: 32 }).notNull(), // 'success', 'failed', 'locked', 'cancelled', 'rejected'
  metadata: text("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

// ==========================================
// Operational Log Tables (Per-Service)
// ==========================================

export const apiLogs = fw.table("api_logs", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  timestamp: timestamp("timestamp", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  level: varchar("level", { length: 16 }).notNull(),
  event: varchar("event", { length: 64 }).notNull(),
  message: text("message").notNull(),
  requestId: varchar("request_id", { length: 64 }),
  correlationId: varchar("correlation_id", { length: 64 }),
  userId: varchar("user_id", { length: 64 }),
  method: varchar("method", { length: 16 }),
  path: varchar("path", { length: 255 }),
  statusCode: integer("status_code"),
  durationMs: integer("duration_ms"),
  component: varchar("component", { length: 64 }),
  errorCode: varchar("error_code", { length: 64 }),
  errorMessage: text("error_message"),
  stackTrace: text("stack_trace"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const webLogs = fw.table("web_logs", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  timestamp: timestamp("timestamp", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  level: varchar("level", { length: 16 }).notNull(),
  event: varchar("event", { length: 64 }).notNull(),
  message: text("message").notNull(),
  requestId: varchar("request_id", { length: 64 }),
  userId: varchar("user_id", { length: 64 }),
  path: varchar("path", { length: 255 }),
  statusCode: integer("status_code"),
  component: varchar("component", { length: 64 }),
  errorMessage: text("error_message"),
  stackTrace: text("stack_trace"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const workerLogs = fw.table("worker_logs", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  timestamp: timestamp("timestamp", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  level: varchar("level", { length: 16 }).notNull(),
  event: varchar("event", { length: 64 }).notNull(),
  message: text("message").notNull(),
  jobId: varchar("job_id", { length: 64 }),
  fileId: varchar("file_id", { length: 64 }),
  stage: varchar("stage", { length: 32 }),
  queueName: varchar("queue_name", { length: 32 }),
  durationMs: integer("duration_ms"),
  errorMessage: text("error_message"),
  stackTrace: text("stack_trace"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const schedulerLogs = fw.table("scheduler_logs", {
  id: bigint("id", { mode: "number" }).primaryKey(),
  timestamp: timestamp("timestamp", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  level: varchar("level", { length: 16 }).notNull(),
  event: varchar("event", { length: 64 }).notNull(),
  message: text("message").notNull(),
  jobName: varchar("job_name", { length: 64 }),
  executionId: varchar("execution_id", { length: 64 }),
  durationMs: integer("duration_ms"),
  scanned: integer("scanned"),
  processed: integer("processed"),
  deleted: integer("deleted"),
  failed: integer("failed"),
  errorMessage: text("error_message"),
  stackTrace: text("stack_trace"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});
