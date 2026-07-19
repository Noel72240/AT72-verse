import type { IsoDateTime, UlidOrUuid } from "../common/primitives.js";

/** Run lifecycle states (Phase 11 / AD1). */
export type RunStatus = "queued" | "running" | "completed" | "failed";

/** Step lifecycle — same four states as runs (Phase 11). */
export type RunStepStatus = "queued" | "running" | "completed" | "failed";

export type MessageRole = "user" | "assistant" | "system";

/**
 * Conversation thread (optional parent of runs — AB2).
 */
export type Conversation = {
  id: UlidOrUuid;
  organization_id: string;
  workspace_id: string;
  created_by_user_id: string | null;
  title: string | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
};

export type Message = {
  id: UlidOrUuid;
  organization_id: string;
  conversation_id: UlidOrUuid;
  role: MessageRole;
  content: string;
  created_at: IsoDateTime;
};

/**
 * Execution unit. `id` and `created_at` are immutable after creation.
 */
export type Run = {
  id: UlidOrUuid;
  organization_id: string;
  workspace_id: string;
  /** Null for system / API / scheduled runs without a chat thread (AB2). */
  conversation_id: UlidOrUuid | null;
  created_by_user_id: string | null;
  status: RunStatus;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
  started_at: IsoDateTime | null;
  completed_at: IsoDateTime | null;
  error: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
};

/**
 * Ordered step within a run. `seq` is the explicit execution order (independent of id).
 * `parent_step_id` prepares DAGs (AC2) — no DAG logic in Phase 11.
 */
export type RunStep = {
  id: UlidOrUuid;
  organization_id: string;
  run_id: UlidOrUuid;
  parent_step_id: UlidOrUuid | null;
  seq: number;
  name: string;
  kind: string;
  agent_id: string | null;
  status: RunStepStatus;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
};

/** Allowed run status transitions (AD1). Terminal: completed, failed. */
export const RUN_STATUS_TRANSITIONS: Readonly<Record<RunStatus, readonly RunStatus[]>> = {
  queued: ["running", "failed"],
  running: ["completed", "failed"],
  completed: [],
  failed: [],
} as const;

export function canTransitionRunStatus(from: RunStatus, to: RunStatus): boolean {
  return (RUN_STATUS_TRANSITIONS[from] as readonly RunStatus[]).includes(to);
}
