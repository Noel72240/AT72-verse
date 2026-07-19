/**
 * Soft delete / audit / GDPR export contracts (Phase 32 / EC*).
 */
import type { IsoDateTime, UlidOrUuid } from "../common/primitives.js";

export type AuditAction =
  | "quota.override"
  | "org.soft_delete"
  | "org.restore"
  | "org.purge"
  | "user.soft_delete"
  | "user.restore"
  | "user.anonymize"
  | "user.purge"
  | "export.requested"
  | "export.completed"
  | "retention.updated";

export type AuditEventPublic = {
  id: UlidOrUuid;
  organization_id: UlidOrUuid | null;
  actor_user_id: UlidOrUuid | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  created_at: IsoDateTime;
};

export type ExportScope = "user" | "organization";

export type ExportJobStatus = "pending" | "completed" | "failed" | "expired";

export type ExportJobPublic = {
  id: UlidOrUuid;
  organization_id: UlidOrUuid | null;
  user_id: UlidOrUuid;
  scope: ExportScope;
  status: ExportJobStatus;
  expires_at: IsoDateTime;
  completed_at: IsoDateTime | null;
  created_at: IsoDateTime;
};

/** Defaults / bounds (EC8 / EC8bis). */
export const SOFT_DELETE_GRACE_DAYS_DEFAULT = 30;
export const SOFT_DELETE_GRACE_DAYS_MIN = 7;
export const SOFT_DELETE_GRACE_DAYS_MAX = 90;
export const AUDIT_RETENTION_DAYS_DEFAULT = 365;
export const AUDIT_RETENTION_DAYS_MIN = 365;
export const EXPORT_ARTIFACT_TTL_HOURS = 48;
