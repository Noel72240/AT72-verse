/**
 * HITL approval contracts (Phase 29).
 * Public DTOs never include OAuth tokens or vault material.
 */
import type { IsoDateTime, UlidOrUuid } from "../common/primitives.js";
import type { PackagesSnapshot } from "../packages/package-registry.js";
import type { CapabilityGrantSnapshot } from "../permissions/permission-grant.js";

export type ApprovalStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "executed";

/** Safe for API / UI inbox. */
export type ApprovalRequestPublic = {
  id: UlidOrUuid;
  organization_id: UlidOrUuid;
  workspace_id: UlidOrUuid;
  run_id: UlidOrUuid;
  step_id: UlidOrUuid | null;
  tool_id: string;
  agent_id: string;
  status: ApprovalStatus;
  /** Redacted preview — never secrets. */
  input_preview: {
    platform?: string;
    mode?: string;
    content_preview?: string;
  };
  expires_at: IsoDateTime;
  decided_at: IsoDateTime | null;
  executed_at: IsoDateTime | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
};

/** Bus payload for `verse.system.approvals.resume` after approve (Phase 29). */
export type ApprovalResumePayload = {
  approval_id: UlidOrUuid;
  organization_id: UlidOrUuid;
  workspace_id: UlidOrUuid;
  run_id: UlidOrUuid;
  step_id: UlidOrUuid | null;
  tool_id: string;
  agent_id: string;
  input: Record<string, unknown>;
  trace_id: UlidOrUuid;
  grants_snapshot?: CapabilityGrantSnapshot | null;
  packages_snapshot?: PackagesSnapshot | null;
  tools_allowlist?: string[];
};
