// Authoritative MitFloww DB Enum Integer Mappings
// All statuses in the database are stored as smallint (int2).

export const ProjectStatus = {
  Draft: "draft",
  Active: "active",
  Archived: "archived",
  Completed: "completed",
} as const;
export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus];

export const ProjectStatusDb = {
  Draft: 0,
  Active: 1,
  Archived: 2,
  Completed: 3,
} as const;
export type ProjectStatusDb = (typeof ProjectStatusDb)[keyof typeof ProjectStatusDb];

export const ProjectPaymentStatus = {
  Pending: "pending",
  Paid: "paid",
  Failed: "failed",
  Refunded: "refunded",
} as const;
export type ProjectPaymentStatus = (typeof ProjectPaymentStatus)[keyof typeof ProjectPaymentStatus];

export const ProjectPaymentStatusDb = {
  Pending: 0,
  Paid: 1,
  Failed: 2,
  Refunded: 3,
} as const;
export type ProjectPaymentStatusDb = (typeof ProjectPaymentStatusDb)[keyof typeof ProjectPaymentStatusDb];

export const FileUploadStatus = {
  Pending: "pending",
  Uploading: "uploading",
  Uploaded: "uploaded",
  Failed: "failed",
} as const;
export type FileUploadStatus = (typeof FileUploadStatus)[keyof typeof FileUploadStatus];

export const FileUploadStatusDb = {
  Pending: 0,
  Uploading: 1,
  Uploaded: 2,
  Failed: 3,
} as const;
export type FileUploadStatusDb = (typeof FileUploadStatusDb)[keyof typeof FileUploadStatusDb];

export const FileApprovalStatus = {
  Pending: "pending",
  Approved: "approved",
  Rejected: "rejected",
} as const;
export type FileApprovalStatus = (typeof FileApprovalStatus)[keyof typeof FileApprovalStatus];

export const FileApprovalStatusDb = {
  Pending: 0,
  Approved: 1,
  Rejected: 2,
} as const;
export type FileApprovalStatusDb = (typeof FileApprovalStatusDb)[keyof typeof FileApprovalStatusDb];

export const FileProcessingStatus = {
  Queued: "queued",
  Processing: "processing",
  Uploading: "uploading",
  Completed: "completed",
  Retrying: "retrying",
  Failed: "failed",
  Corrupt: "corrupt",
  Skipped: "skipped",
  Cancelled: "cancelled",
} as const;
export type FileProcessingStatus = (typeof FileProcessingStatus)[keyof typeof FileProcessingStatus];

export const FileProcessingStatusDb = {
  Queued: 0,
  Processing: 1,
  Uploading: 2,
  Completed: 3,
  Retrying: 4,
  Failed: 5,
  Corrupt: 6,
  Skipped: 7,
  Cancelled: 8,
} as const;
export type FileProcessingStatusDb = (typeof FileProcessingStatusDb)[keyof typeof FileProcessingStatusDb];

export const FileVersionReportStatus = {
  Reported: "reported",
  UnderReview: "under_review",
  Resolved: "resolved",
  Dismissed: "dismissed",
} as const;
export type FileVersionReportStatus = (typeof FileVersionReportStatus)[keyof typeof FileVersionReportStatus];

export const FileVersionReportStatusDb = {
  Reported: 0,
  UnderReview: 1,
  Resolved: 2,
  Dismissed: 3,
} as const;
export type FileVersionReportStatusDb = (typeof FileVersionReportStatusDb)[keyof typeof FileVersionReportStatusDb];

export const AssetStatus = {
  Draft: "draft",
  Active: "active",
} as const;
export type AssetStatus = (typeof AssetStatus)[keyof typeof AssetStatus];

export const AssetStatusDb = {
  Draft: 0,
  Active: 1,
} as const;
export type AssetStatusDb = (typeof AssetStatusDb)[keyof typeof AssetStatusDb];

export const UserStatus = {
  Active: "active",
  Suspended: "suspended",
  Deactivated: "deactivated",
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const UserStatusDb = {
  Active: 0,
  Suspended: 1,
  Deactivated: 2,
} as const;
export type UserStatusDb = (typeof UserStatusDb)[keyof typeof UserStatusDb];

export const SchedulerJobStatus = {
  Idle: "idle",
  Running: "running",
  Success: "success",
  Failed: "failed",
  Locked: "locked",
} as const;
export type SchedulerJobStatus = (typeof SchedulerJobStatus)[keyof typeof SchedulerJobStatus];
