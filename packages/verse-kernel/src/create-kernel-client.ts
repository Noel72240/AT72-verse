import { randomUUID } from "node:crypto";
import type {
  CapabilityGrantSnapshot,
  BudgetSnapshot,
  PackagesSnapshot,
  KernelClient,
  KernelContext,
} from "@at72-verse/contracts";
import { KernelError } from "./errors.js";
import type { KernelInstrumentationSink } from "./instrumentation.js";
import { StubKernelClient } from "./stub-kernel-client.js";

/**
 * Input for creating a Kernel client. Provided by the **runtime**, never by agent syscall args.
 */
export type CreateKernelContextInput = {
  run_id: string;
  agent_id: string;
  organization_id: string;
  workspace_id: string;
  user_id?: string | null;
  /** Optional — generated when omitted. */
  trace_id?: string;
  /** Optional — generated when omitted. */
  span_id?: string;
  /** Optional alias; defaults to organization_id. */
  tenant_id?: string;
  /** Current RunStep id (Phase 15 — parent for orchestration.delegate). */
  step_id?: string | null;
  /** Delegation nesting depth (Phase 15 / BV1). */
  delegation_depth?: number;
  /** Conversation thread for L2 memory (Phase 18). */
  conversation_id?: string | null;
  /** Agent tools allowlist (Phase 19 / DM5). */
  tools_allowlist?: string[];
  /** Frozen capability grants (Phase 20 / DN8). */
  grants_snapshot?: CapabilityGrantSnapshot | null;
  /** Frozen run budget (Phase 21 / DO6). */
  budget_snapshot?: BudgetSnapshot | null;
  /** Frozen package installs (Phase 22 / DP9). */
  packages_snapshot?: PackagesSnapshot | null;
  /** When true, block nested orchestration (Phase 24 / DR6 consult). */
  orchestration_locked?: boolean;
  /** Phase 29 HITL resume — claim before live side-effect. */
  resume_approval_id?: string | null;
};

/** Host-selected Kernel backend (Decision L2). Agents never set this. */
export type KernelBackend = "stub" | "core";

export type CreateKernelClientOptions = {
  context: CreateKernelContextInput;
  /** Optional sink for observability prep (Decision I) — does not change KernelClient API. */
  instrumentation?: KernelInstrumentationSink;
  /**
   * Host-only override. Defaults to `VERSE_KERNEL_BACKEND` or `"stub"`.
   * Agents must not pass this.
   */
  backend?: KernelBackend;
  /**
   * Required when backend is `"core"`. Provided by the host after `createVerseCore()`.
   * Keeps `@at72-verse/verse-kernel` free of a hard dependency on `@at72-verse/verse-core`.
   */
  coreFactory?: (context: KernelContext) => KernelClient;
};

function resolveContext(input: CreateKernelContextInput): KernelContext {
  const organization_id = input.organization_id;
  const tenant_id = input.tenant_id ?? organization_id;
  return {
    run_id: input.run_id,
    trace_id: input.trace_id ?? randomUUID(),
    span_id: input.span_id ?? randomUUID(),
    agent_id: input.agent_id,
    organization_id,
    tenant_id,
    workspace_id: input.workspace_id,
    user_id: input.user_id ?? null,
    conversation_id: input.conversation_id ?? null,
    tools_allowlist: input.tools_allowlist ? [...input.tools_allowlist] : [],
    grants_snapshot: input.grants_snapshot ?? null,
    budget_snapshot: input.budget_snapshot ?? null,
    packages_snapshot: input.packages_snapshot ?? null,
    step_id: input.step_id ?? null,
    delegation_depth: input.delegation_depth ?? 0,
    ...(input.orchestration_locked ? { orchestration_locked: true } : {}),
    ...(input.resume_approval_id ? { resume_approval_id: input.resume_approval_id } : {}),
  };
}

function resolveBackend(options: CreateKernelClientOptions): KernelBackend {
  if (options.backend) {
    return options.backend;
  }
  const fromEnv = process.env.VERSE_KERNEL_BACKEND;
  if (fromEnv === "core" || fromEnv === "stub") {
    return fromEnv;
  }
  return "stub";
}

/**
 * Factory — transport / backend selection is internal (ADR-002, Decision L2).
 * - `stub` (default): deterministic in-memory stub — CI / unit reference.
 * - `core`: in-process Core binding via host-provided `coreFactory`.
 * Agents never observe which backend is active.
 */
export function createKernelClient(options: CreateKernelClientOptions): KernelClient {
  const context = resolveContext(options.context);
  const backend = resolveBackend(options);

  if (backend === "core") {
    if (!options.coreFactory) {
      throw new KernelError(
        "UNAVAILABLE",
        'Kernel backend "core" requires a host-provided coreFactory',
        { details: { backend: "core" } },
      );
    }
    return options.coreFactory(context);
  }

  return new StubKernelClient(context, {
    instrumentation: options.instrumentation,
  });
}
