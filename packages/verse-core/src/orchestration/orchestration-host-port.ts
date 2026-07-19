/**
 * Host-provided agent orchestration port (Phase 15 / BO1 · Phase 24 / DR2 · DR6).
 * Runtime registers agents; Core never imports agents/*.
 */
import type {
  CapabilityGrantSnapshot,
  BudgetSnapshot,
  PackagesSnapshot,
  OrchestrationAskResult,
  OrchestrationDelegateManyResult,
  OrchestrationDelegateResult,
} from "@at72-verse/contracts";

/**
 * Envelope for a delegated agent task.
 * All correlation fields are filled by Core from KernelContext — agents never invent them.
 */
export type OrchestrationDelegateHostRequest = {
  target_agent: string;
  task: Record<string, unknown>;
  run_id: string;
  trace_id: string;
  /** Caller's RunStep id — becomes the child's parent_step_id. */
  parent_step_id: string | null;
  caller_agent_id: string;
  /** Depth of the caller (0 = root). Host enforces max depth. */
  caller_delegation_depth: number;
  organization_id: string;
  workspace_id: string;
  conversation_id?: string | null;
  user_id?: string | null;
  grants_snapshot?: CapabilityGrantSnapshot | null;
  budget_snapshot?: BudgetSnapshot | null;
  packages_snapshot?: PackagesSnapshot | null;
  deadline_at?: string;
};

export type OrchestrationDelegateManyHostRequest = {
  targets: Array<{ target_agent: string; task: Record<string, unknown> }>;
  run_id: string;
  trace_id: string;
  parent_step_id: string | null;
  caller_agent_id: string;
  caller_delegation_depth: number;
  organization_id: string;
  workspace_id: string;
  conversation_id?: string | null;
  user_id?: string | null;
  grants_snapshot?: CapabilityGrantSnapshot | null;
  budget_snapshot?: BudgetSnapshot | null;
  packages_snapshot?: PackagesSnapshot | null;
  deadline_at?: string;
};

export type OrchestrationAskHostRequest = {
  target_agent: string;
  question: Record<string, unknown>;
  run_id: string;
  trace_id: string;
  parent_step_id: string | null;
  caller_agent_id: string;
  /** Depth is recorded for context only — ask does not increment it (DR6). */
  caller_delegation_depth: number;
  organization_id: string;
  workspace_id: string;
  conversation_id?: string | null;
  user_id?: string | null;
  grants_snapshot?: CapabilityGrantSnapshot | null;
  budget_snapshot?: BudgetSnapshot | null;
  packages_snapshot?: PackagesSnapshot | null;
};

/**
 * Awaitable orchestration. Implementations must:
 * - Record child steps via Bus BEFORE starting work (delegate / ask)
 * - Keep delegateMany results ordered as `targets`
 * - Never allow ask to nest orchestration
 */
export type OrchestrationHostPort = {
  delegate(request: OrchestrationDelegateHostRequest): Promise<OrchestrationDelegateResult>;
  delegateMany(
    request: OrchestrationDelegateManyHostRequest,
  ): Promise<OrchestrationDelegateManyResult>;
  ask(request: OrchestrationAskHostRequest): Promise<OrchestrationAskResult>;
};
