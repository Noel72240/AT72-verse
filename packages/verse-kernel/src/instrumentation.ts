import type { KernelContext } from "@at72-verse/contracts";

/**
 * Record of a single syscall for tests / debugging (Decision H1).
 * Not part of the public KernelClient surface.
 */
export type KernelCallRecord = {
  family: string;
  method: string;
  input: unknown;
  output?: unknown;
  error?: {
    code: string;
    message: string;
  };
  success: boolean;
  duration_ms: number;
  /** Optional estimated cost in USD (stub may attach synthetic cost). */
  cost_usd: number | null;
  started_at: string;
  context: {
    run_id: string;
    trace_id: string;
    span_id: string;
    agent_id: string;
    organization_id: string;
    workspace_id: string;
    user_id: string | null;
  };
};

export type KernelInstrumentationSink = {
  onCall(record: KernelCallRecord): void;
};

export function contextSnapshot(context: KernelContext): KernelCallRecord["context"] {
  return {
    run_id: context.run_id,
    trace_id: context.trace_id,
    span_id: context.span_id,
    agent_id: context.agent_id,
    organization_id: context.organization_id,
    workspace_id: context.workspace_id,
    user_id: context.user_id,
  };
}
