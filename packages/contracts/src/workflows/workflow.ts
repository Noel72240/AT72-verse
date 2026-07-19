/**
 * Workflow contracts (Phase 26 / DT1–DT12).
 * Engine interprets these — agents carry intelligence; Engine has no business logic.
 */
import type { IsoDateTime, UlidOrUuid } from "../common/primitives.js";

/**
 * Step kinds — closed for P26; open for extension without rewriting the engine.
 * Future (reserved): condition | loop | wait_event | hitl | ask
 */
export type WorkflowStepKind =
  | "memory_remember"
  | "fan_out"
  | "delegate"
  | "checkpoint"
  | "noop";

export type WorkflowTrigger = "manual"; // P26 — schedule|webhook|event later

export type WorkflowStepSpec = {
  id: string;
  kind: WorkflowStepKind;
  /** Steps that must complete before this one. */
  needs?: string[];
  /** Single-agent delegate target. */
  agent?: string;
  /** Fan-out targets (order = deterministic result order). */
  targets?: string[];
  /** memory_remember scope (default run.working). */
  scope?: string;
  /** Opaque config for future node types — Engine must ignore unknown keys safely. */
  config?: Record<string, unknown>;
};

export type WorkflowDefinition = {
  id: string;
  version: string;
  display_name: string;
  description?: string;
  trigger: WorkflowTrigger;
  steps: WorkflowStepSpec[];
};

/** Workflow run lifecycle (Phase 26 / DT6). */
export type WorkflowRunStatus =
  | "queued"
  | "running"
  | "waiting_checkpoint"
  | "paused"
  | "completed"
  | "failed";

export type WorkflowRun = {
  id: UlidOrUuid;
  organization_id: UlidOrUuid;
  workspace_id: UlidOrUuid;
  workflow_id: string;
  workflow_version: string;
  /** Linked platform Run (Timeline / bus). */
  run_id: UlidOrUuid;
  status: WorkflowRunStatus;
  /** Frozen definition at start (DT11). */
  definition_snapshot: WorkflowDefinition;
  /** Completed step ids (checkpoint cursor). */
  completed_step_ids: string[];
  /** Next step id(s) ready after resume — usually one. */
  cursor_step_id: string | null;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: Record<string, unknown> | null;
  created_by_user_id: UlidOrUuid | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
  started_at: IsoDateTime | null;
  completed_at: IsoDateTime | null;
};

export const WORKFLOW_RUN_STATUS_TRANSITIONS: Record<
  WorkflowRunStatus,
  readonly WorkflowRunStatus[]
> = {
  queued: ["running", "failed"],
  running: ["waiting_checkpoint", "paused", "completed", "failed"],
  waiting_checkpoint: ["running", "paused", "failed"],
  paused: ["running", "failed"],
  completed: [],
  failed: [],
};

export function canTransitionWorkflowRunStatus(
  from: WorkflowRunStatus,
  to: WorkflowRunStatus,
): boolean {
  return (WORKFLOW_RUN_STATUS_TRANSITIONS[from] as readonly string[]).includes(to);
}
