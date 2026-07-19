/**
 * Cost Engine (Phase 21 / DO1 · DO7).
 * Unique budget authority — agents never check costs themselves.
 */
import type { BudgetSnapshot, KernelContext, ModelProfileId } from "@at72-verse/contracts";
import {
  PLATFORM_DEFAULT_RUN_BUDGET,
  PLATFORM_RATE_CARD_VERSION,
} from "@at72-verse/contracts";
import { KernelError } from "@at72-verse/verse-kernel";
import { estimateProfileApproxUsd, estimateTokensUsd, getRateCardVersion } from "./rate-card.js";

type RunLedger = {
  snapshot: BudgetSnapshot;
  spent_usd: number;
  spent_tokens: number;
};

export function buildBudgetSnapshot(input: {
  organization_id: string;
  workspace_id: string;
  run_id: string;
  max_usd?: number;
  max_tokens?: number;
  pricing_version?: string;
  captured_at?: string;
}): BudgetSnapshot {
  return {
    version: "1",
    organization_id: input.organization_id,
    workspace_id: input.workspace_id,
    run_id: input.run_id,
    captured_at: input.captured_at ?? new Date().toISOString(),
    max_usd: input.max_usd ?? PLATFORM_DEFAULT_RUN_BUDGET.max_usd,
    max_tokens: input.max_tokens ?? PLATFORM_DEFAULT_RUN_BUDGET.max_tokens,
    pricing_version: input.pricing_version ?? PLATFORM_RATE_CARD_VERSION,
  };
}

export class CostEngine {
  private readonly ledgers = new Map<string, RunLedger>();
  /** Per-run serialization chain (Phase 24 / DR8) — internal only; Kernel.cost API unchanged. */
  private readonly runChains = new Map<string, Promise<unknown>>();

  /**
   * Run `fn` exclusively for a given run_id (parallel fan-out safe).
   * Distributed locking may replace this later without changing Kernel.cost.*.
   */
  runExclusive<T>(runId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.runChains.get(runId) ?? Promise.resolve();
    const next = prev.then(
      () => fn(),
      () => fn(),
    );
    this.runChains.set(
      runId,
      next.then(
        () => undefined,
        () => undefined,
      ),
    );
    return next;
  }

  /** Bind (or no-op if already bound) the frozen snapshot for a run. */
  bindSnapshot(snapshot: BudgetSnapshot): void {
    if (this.ledgers.has(snapshot.run_id)) return;
    this.ledgers.set(snapshot.run_id, {
      snapshot,
      spent_usd: 0,
      spent_tokens: 0,
    });
  }

  estimate(profile: ModelProfileId | string, approxTokens: number): { usd: number } {
    return { usd: estimateProfileApproxUsd(profile, approxTokens) };
  }

  getBudget(context: KernelContext): { remaining_usd: number; remaining_tokens: number } {
    const ledger = this.requireLedger(context);
    return {
      remaining_usd: round6(Math.max(0, ledger.snapshot.max_usd - ledger.spent_usd)),
      remaining_tokens: Math.max(0, ledger.snapshot.max_tokens - ledger.spent_tokens),
    };
  }

  /**
   * Pre-flight hard-stop (DO7). Refuses when remaining budget is exhausted.
   */
  assertCanStartLlmCall(context: KernelContext): void {
    const ledger = this.requireLedger(context);
    const remainingUsd = ledger.snapshot.max_usd - ledger.spent_usd;
    const remainingTokens = ledger.snapshot.max_tokens - ledger.spent_tokens;
    if (remainingUsd <= 0 || remainingTokens <= 0) {
      throw new KernelError("BUDGET_EXCEEDED", "Run budget exhausted", {
        details: {
          run_id: context.run_id,
          max_usd: ledger.snapshot.max_usd,
          max_tokens: ledger.snapshot.max_tokens,
          spent_usd: ledger.spent_usd,
          spent_tokens: ledger.spent_tokens,
          remaining_usd: round6(Math.max(0, remainingUsd)),
          remaining_tokens: Math.max(0, remainingTokens),
          pricing_version: ledger.snapshot.pricing_version,
        },
      });
    }
  }

  /**
   * Record actual LLM usage into the in-memory run ledger.
   * Throws BUDGET_EXCEEDED if this call pushes the run over the ceiling (post-check).
   */
  recordLlmUsage(input: {
    context: KernelContext;
    model: string;
    input_tokens: number;
    output_tokens: number;
  }): { estimated_usd: number; pricing_version: string } {
    const ledger = this.requireLedger(input.context);
    const priced = estimateTokensUsd({
      model: input.model,
      input_tokens: input.input_tokens,
      output_tokens: input.output_tokens,
    });
    // Prefer snapshot pricing_version for reproducibility of the run.
    const pricing_version = ledger.snapshot.pricing_version || priced.pricing_version;
    const tokens = input.input_tokens + input.output_tokens;
    ledger.spent_usd = round6(ledger.spent_usd + priced.estimated_usd);
    ledger.spent_tokens += tokens;

    if (
      ledger.spent_usd > ledger.snapshot.max_usd ||
      ledger.spent_tokens > ledger.snapshot.max_tokens
    ) {
      throw new KernelError("BUDGET_EXCEEDED", "Run budget exceeded after LLM call", {
        details: {
          run_id: input.context.run_id,
          max_usd: ledger.snapshot.max_usd,
          max_tokens: ledger.snapshot.max_tokens,
          spent_usd: ledger.spent_usd,
          spent_tokens: ledger.spent_tokens,
          call_estimated_usd: priced.estimated_usd,
          pricing_version,
        },
      });
    }

    return { estimated_usd: priced.estimated_usd, pricing_version };
  }

  /** Pure pricing helper for Bus payload (same Rate Card). */
  priceLlmCall(input: {
    model: string;
    input_tokens: number;
    output_tokens: number;
  }): { estimated_usd: number; pricing_version: string } {
    return estimateTokensUsd(input);
  }

  getRateCardVersion(): string {
    return getRateCardVersion();
  }

  /** Test helper — current spent for a run. */
  getSpent(runId: string): { spent_usd: number; spent_tokens: number } | null {
    const ledger = this.ledgers.get(runId);
    if (!ledger) return null;
    return { spent_usd: ledger.spent_usd, spent_tokens: ledger.spent_tokens };
  }

  private requireLedger(context: KernelContext): RunLedger {
    const snapshot = context.budget_snapshot;
    if (!snapshot) {
      throw new KernelError("BUDGET_EXCEEDED", "budget_snapshot missing for run", {
        details: { run_id: context.run_id, reason: "budget_snapshot_missing" },
      });
    }
    this.bindSnapshot(snapshot);
    const ledger = this.ledgers.get(snapshot.run_id);
    if (!ledger) {
      throw new KernelError("INTERNAL", "Cost ledger failed to bind", {
        details: { run_id: snapshot.run_id },
      });
    }
    return ledger;
  }
}

function round6(value: number): number {
  return Number(value.toFixed(6));
}
