export const APP_NAME = "mitfloww-scheduler";

// S3 Batch Deletion limit per official AWS/S3 specification
export const S3_BATCH_DELETE_MAX_KEYS = 1000;

// Default pagination batch sizes
export const DEFAULT_QUERY_BATCH_SIZE = 100;
export const MAX_QUERY_BATCH_SIZE = 500;

// Retry constants
export const DEFAULT_MAX_RETRIES = 3;
export const DEFAULT_INITIAL_BACKOFF_MS = 1000;
export const DEFAULT_MAX_BACKOFF_MS = 10000;

// Canonical R2 Storage prefixes
export const USERS_STORAGE_KEY_PREFIX = "users";
export const MANAGED_UPLOAD_STORAGE_KEY_PREFIX = "projects";

// Default Job Intervals (in milliseconds)
export const JOB_INTERVALS = {
  EXPIRED_PROJECTS: 15 * 60 * 1000,      // Every 15 minutes
  REVISION_LIFECYCLE: 60 * 60 * 1000,    // Every 1 hour
  STALE_UPLOADS: 30 * 60 * 1000,         // Every 30 minutes
  ORPHANED_FILES: 2 * 60 * 60 * 1000,    // Every 2 hours
  SOFT_DELETED_ASSETS: 60 * 60 * 1000,   // Every 1 hour
  DELETED_USERS: 6 * 60 * 60 * 1000,
  LOG_RETENTION: 12 * 60 * 60 * 1000,     // Every 6 hours
} as const;
