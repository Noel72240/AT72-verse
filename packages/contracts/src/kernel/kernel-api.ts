import type { ModelProfileId } from "../common/model-profiles.js";
import type { IsoDateTime, UlidOrUuid } from "../common/primitives.js";
import type { BudgetSnapshot } from "../cost/budget-snapshot.js";
import type { LlmCredentialSource } from "../llm/llm-usage.js";
import type { PackagesSnapshot } from "../packages/package-registry.js";
import type { CapabilityGrantSnapshot } from "../permissions/permission-grant.js";
import type { ResolvedPersona } from "../personas/resolved-persona.js";

/**
 * Kernel public API stubs (ADR-002).
 * Agents/skills depend on this surface only — no transport details.
 */

/**
 * Execution context scoped to a Kernel client instance (ADR-002, Phase 07).
 * Injected by the runtime — agents never pass these fields on syscalls.
 */
export interface KernelContext {
  run_id: UlidOrUuid;
  /** Distributed trace id (propagated to every syscall instrumentation). */
  trace_id: UlidOrUuid;
  /** Current span id for this Kernel client / run step. */
  span_id: UlidOrUuid;
  agent_id: string;
  /**
   * Billing / tenancy organization id.
   * Prefer this over `tenant_id` (kept as alias for freeze-v0 compatibility).
   */
  organization_id: UlidOrUuid;
  /** @deprecated Alias of `organization_id` (freeze v0). */
  tenant_id: UlidOrUuid;
  workspace_id: UlidOrUuid;
  /** End-user id when the run is user-initiated; null for system runs. */
  user_id: UlidOrUuid | null;
  /**
   * Conversation thread id when the run is chat-backed (Phase 18 / L2).
   * Null for system / non-chat runs.
   */
  conversation_id?: UlidOrUuid | null;
  /**
   * Agent tools allowlist from AgentManifest (Phase 19 / DM5).
   * Intersected with Persona.spec.tools — stamped by Runtime, never by agents.
   */
  tools_allowlist?: string[];
  /**
   * Frozen capability grants for this run/task (Phase 20 / DN8).
   * Permission Engine reads this snapshot — not live DB mid-run.
   */
  grants_snapshot?: CapabilityGrantSnapshot | null;
  /**
   * Frozen run budget for this run/task (Phase 21 / DO6).
   * Cost Engine reads this snapshot — not live workspace settings mid-run.
   */
  budget_snapshot?: BudgetSnapshot | null;
  /**
   * Frozen org package installs for this run/task (Phase 22 / DP9).
   * Install gate reads this snapshot — not live DB mid-run.
   */
  packages_snapshot?: PackagesSnapshot | null;
  /**
   * Current RunStep id for this agent invocation (Phase 15).
   * Used by `orchestration.delegate` as `parent_step_id` — agents never pass it.
   */
  step_id?: UlidOrUuid | null;
  /**
   * Nesting depth of `orchestration.delegate` (0 = root agent). Injected by Runtime.
   */
  delegation_depth?: number;
  /**
   * When true, orchestration.delegate / delegateMany / ask are forbidden (Phase 24 / DR6).
   * Set on consult targets so ask cannot trigger nested orchestration.
   */
  orchestration_locked?: boolean;
  /**
   * Phase 29 HITL resume — stamped by Runtime after approve; agents never set this.
   * ToolRuntime claims the approval (approved→executed) before any live side-effect.
   */
  resume_approval_id?: UlidOrUuid | null;
}

export interface LlmCompleteRequest {
  profile: ModelProfileId;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  max_tokens?: number;
}

export interface LlmCompletion {
  content: string;
  /** Unique id for this LLM invocation (propagated to usage events). */
  llm_call_id: UlidOrUuid;
  usage: {
    input_tokens: number;
    output_tokens: number;
    credential_source: LlmCredentialSource;
  };
}

export interface LlmEmbedRequest {
  profile: ModelProfileId;
  input: string | string[];
}

export interface LlmEmbedding {
  vectors: number[][];
}

/** Memory layer (ARCHITECTURE §16.1). Phase 18 = L1+L2 ; Phase 25 adds L4. */
export type MemoryLayer = "L1" | "L2" | "L4";

/** Record kinds (ARCHITECTURE §16.2). */
export type MemoryRecordType =
  | "ephemeral"
  | "conversational"
  | "factual"
  | "procedural"
  | "artifact_ref"
  | "credential_ref";

export interface MemoryRememberRequest {
  scope: string;
  content: string;
  type?: MemoryRecordType | string;
}

export interface MemoryRecallRequest {
  scope?: string;
  query: string;
  limit?: number;
}

/**
 * Explainable recall ranking (Phase 25 / PO constraints).
 * Scores are deterministic for identical inputs + store state.
 */
export interface MemoryRecallExplanation {
  strategy: "substring" | "semantic" | "semantic_disabled_fallback";
  /** Similarity in [0, 1], rounded to 6 decimals. */
  score: number;
  /** Cosine distance (= 1 - score) for semantic ; 0 for substring hits. */
  distance: number;
  source: "memory_store" | "vector_index";
}

/**
 * Persisted memory record (Phase 18 / DL3 · Phase 25 L4).
 * Metadata is part of the persistence contract — not optional transport fluff.
 */
export interface MemoryRecord {
  /** Stable UUID — identity does not change after insert. */
  id: UlidOrUuid;
  scope: string;
  content: string;
  layer: MemoryLayer;
  type: MemoryRecordType;
  organization_id: UlidOrUuid;
  workspace_id: UlidOrUuid;
  run_id: UlidOrUuid | null;
  conversation_id: UlidOrUuid | null;
  user_id: UlidOrUuid | null;
  agent_id: string | null;
  /** Trace id at write time when available (DL traçabilité). */
  trace_id: UlidOrUuid | null;
  created_at: IsoDateTime;
  pinned?: boolean;
  /** Soft-delete timestamp (Phase 25 / DS7). */
  deleted_at?: IsoDateTime | null;
  /** Populated on recall when ranking metadata is available. */
  explanation?: MemoryRecallExplanation;
}

export interface ToolExecuteRequest {
  tool_id: string;
  input: Record<string, unknown>;
}

export interface ToolExecuteResult {
  output: Record<string, unknown>;
  /** Stable audit id for this attempt (Phase 19). */
  execution_id: UlidOrUuid;
}

export interface SkillInvokeRequest {
  skill_id: string;
  input: Record<string, unknown>;
}

export interface SkillInvokeResult {
  output: Record<string, unknown>;
}

export interface OrchestrationDelegateRequest {
  target_agent: string;
  task: Record<string, unknown>;
  deadline_at?: IsoDateTime;
}

/** Result of a synchronous (awaited) delegation (Phase 15 / BN1). */
export interface OrchestrationDelegateResult {
  step_id: string;
  status: "completed" | "failed";
  result?: Record<string, unknown>;
  error?: string;
}

/** Fan-out target (Phase 24 / DR2). */
export interface OrchestrationDelegateManyTarget {
  target_agent: string;
  task: Record<string, unknown>;
}

/**
 * Fan-out request (Phase 24 / DR2).
 * Results are returned in the **same order** as `targets` (deterministic, DR extra).
 */
export interface OrchestrationDelegateManyRequest {
  targets: OrchestrationDelegateManyTarget[];
  deadline_at?: IsoDateTime;
}

export interface OrchestrationDelegateManyResult {
  /** Same length and order as request.targets. */
  results: OrchestrationDelegateResult[];
}

/** Ask / Consult result (Phase 24 / DR6). */
export interface OrchestrationAskResult {
  from: string;
  answer: Record<string, unknown>;
  step_id?: string;
  status: "completed" | "failed";
  error?: string;
}

export interface KernelLlmApi {
  complete(request: LlmCompleteRequest): Promise<LlmCompletion>;
  stream(request: LlmCompleteRequest): AsyncIterable<{ delta: string }>;
  embed(request: LlmEmbedRequest): Promise<LlmEmbedding>;
}

export interface KernelMemoryApi {
  remember(request: MemoryRememberRequest): Promise<MemoryRecord>;
  recall(request: MemoryRecallRequest): Promise<MemoryRecord[]>;
  summarize(scope: string): Promise<string>;
  forget(id: string): Promise<void>;
  pin(id: string): Promise<void>;
  link(fromId: string, toId: string): Promise<void>;
}

export interface KernelToolsApi {
  execute(request: ToolExecuteRequest): Promise<ToolExecuteResult>;
  listAvailable(): Promise<string[]>;
}

export interface KernelSkillsApi {
  invoke(request: SkillInvokeRequest): Promise<SkillInvokeResult>;
  resolve(skillId: string): Promise<{ id: string; version: string }>;
}

export interface KernelPersonaApi {
  /** Resolve merged immutable persona for an agent (Phase 17). */
  resolve(agentId: string): Promise<ResolvedPersona>;
}

export interface KernelOrchestrationApi {
  /**
   * Delegate work to another agent and await completion (BN1).
   * Propagates `run_id`, `trace_id`, and `parent_step_id` from Kernel context automatically.
   */
  delegate(request: OrchestrationDelegateRequest): Promise<OrchestrationDelegateResult>;
  /**
   * Fan-out: delegate to multiple agents in parallel (Phase 24 / DR2).
   * Results are ordered identically to `targets` regardless of finish order.
   */
  delegateMany(request: OrchestrationDelegateManyRequest): Promise<OrchestrationDelegateManyResult>;
  /**
   * Lightweight specialist consult (Phase 24 / DR6).
   * Does not increment delegation_depth and must not trigger nested orchestration.
   */
  ask(targetAgent: string, question: Record<string, unknown>): Promise<OrchestrationAskResult>;
  completeTask(stepId: string, result: Record<string, unknown>): Promise<void>;
  requestHitl(reason: string): Promise<{ approval_id: string }>;
}

export interface KernelEventsApi {
  emit(eventType: string, payload: Record<string, unknown>): Promise<void>;
}

export interface KernelArtifactsApi {
  write(name: string, data: unknown): Promise<{ artifact_id: string }>;
  read(artifactId: string): Promise<unknown>;
  list(): Promise<Array<{ artifact_id: string; name: string }>>;
}

export interface KernelCostApi {
  estimate(profile: ModelProfileId, approxTokens: number): Promise<{ usd: number }>;
  getBudget(): Promise<{ remaining_usd: number; remaining_tokens: number }>;
}

export interface KernelRegistryApi {
  getAgent(id: string): Promise<Record<string, unknown>>;
  getSkill(id: string): Promise<Record<string, unknown>>;
  getTool(id: string): Promise<Record<string, unknown>>;
}

export interface KernelFilesApi {
  upload(path: string, bytes: Uint8Array): Promise<{ file_id: string }>;
  download(fileId: string): Promise<Uint8Array>;
}

/**
 * Injected Kernel client — transport is opaque (ADR-002).
 */
export interface KernelClient {
  readonly context: KernelContext;
  readonly llm: KernelLlmApi;
  readonly memory: KernelMemoryApi;
  readonly tools: KernelToolsApi;
  readonly skills: KernelSkillsApi;
  readonly persona: KernelPersonaApi;
  readonly orchestration: KernelOrchestrationApi;
  readonly events: KernelEventsApi;
  readonly artifacts: KernelArtifactsApi;
  readonly cost: KernelCostApi;
  readonly registry: KernelRegistryApi;
  readonly files: KernelFilesApi;
}
