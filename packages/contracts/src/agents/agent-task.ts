import type { UlidOrUuid } from "../common/primitives.js";
import type { BudgetSnapshot } from "../cost/budget-snapshot.js";
import type { PackagesSnapshot } from "../packages/package-registry.js";
import type { CapabilityGrantSnapshot } from "../permissions/permission-grant.js";
import type { PersonaSpecPatch, ResolvedPersona } from "../personas/resolved-persona.js";

/**
 * Minimal agent task payload (Phase 12 / AK1).
 * Envelope BusMessage always carries the same `run_id`.
 */
export type AgentTaskPayload = {
  run_id: UlidOrUuid;
  step_id?: UlidOrUuid;
  /** Parent RunStep when this task was created by orchestration.delegate (BQ1). */
  parent_step_id?: UlidOrUuid | null;
  goal?: string;
  /** End-to-end trace (also echoed on completion events). */
  trace_id: UlidOrUuid;
  /** Nesting depth for anti-loop guards (BV1). */
  delegation_depth?: number;
  /**
   * Persona overrides stamped by API at dispatch (Phase 17 / ADR-010).
   * Runtime feeds these into Core PersonaOverridePort — no Prisma in Runtime.
   */
  persona_org_override?: PersonaSpecPatch;
  persona_workspace_override?: PersonaSpecPatch;
  /** Chat thread for L2 conversation memory (Phase 18). */
  conversation_id?: UlidOrUuid | null;
  /** End-user who initiated the run — required for user-scoped memory isolation. */
  user_id?: UlidOrUuid | null;
  /** Frozen grants at dispatch (Phase 20 / DN8). */
  grants_snapshot?: CapabilityGrantSnapshot;
  /** Frozen run budget at dispatch (Phase 21 / DO6). */
  budget_snapshot?: BudgetSnapshot;
  /** Frozen org package installs at dispatch (Phase 22 / DP9). */
  packages_snapshot?: PackagesSnapshot;
};

/** Deterministic plan step produced by an agent (materialized as RunStep by API). */
export type AgentPlanStepSpec = {
  name: string;
  kind: string;
  agent_id?: string;
};

export type AgentPlan = {
  version: "1";
  steps: AgentPlanStepSpec[];
};

/**
 * Agent → platform signal (AP3). Distinct from `verse.runs.*` projections.
 */
export type AgentTaskCompletedPayload = {
  agent_id: string;
  run_id: UlidOrUuid;
  step_id?: UlidOrUuid;
  trace_id: UlidOrUuid;
  plan: AgentPlan;
  status: "completed" | "failed" | "waiting_approval";
  error?: string;
  /** Optional agent result payload (e.g. skill output) — Phase 14 / BK1. */
  result?: Record<string, unknown>;
  /** Phase 29 HITL — present when status is waiting_approval. */
  approval_id?: UlidOrUuid;
  /** Persona actually used for this agent step (Phase 17 / DG1). */
  resolved_persona?: ResolvedPersona;
};

/**
 * Emitted before a delegated agent starts (Phase 15) — Run must record the child step first.
 */
export type AgentTaskDelegatedPayload = {
  agent_id: string;
  delegated_by: string;
  run_id: UlidOrUuid;
  /** Child step id (pre-allocated). */
  step_id: UlidOrUuid;
  parent_step_id: UlidOrUuid | null;
  trace_id: UlidOrUuid;
  task: Record<string, unknown>;
};

/**
 * Emitted before a consult (ask) starts (Phase 24 / DR6) — timeline-traceable, not a delegate.
 */
export type AgentTaskConsultedPayload = {
  agent_id: string;
  consulted_by: string;
  run_id: UlidOrUuid;
  step_id: UlidOrUuid;
  parent_step_id: UlidOrUuid | null;
  trace_id: UlidOrUuid;
  question: Record<string, unknown>;
};
