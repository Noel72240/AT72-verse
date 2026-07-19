/**
 * Run budget snapshot (Phase 21 / DO6).
 * Frozen at Run dispatch — Runtime Cost Engine reads this, not live workspace settings.
 */
import type { IsoDateTime, UlidOrUuid } from "../common/primitives.js";

export type BudgetSnapshot = {
  version: "1";
  organization_id: UlidOrUuid;
  workspace_id: UlidOrUuid;
  run_id: UlidOrUuid;
  captured_at: IsoDateTime;
  /** Hard ceiling in USD for this run. */
  max_usd: number;
  /** Hard ceiling in total tokens (input + output) for this run. */
  max_tokens: number;
  /** Rate card version used for all estimates on this run. */
  pricing_version: string;
};

/** Platform defaults when workspace has no override (DO5). */
export const PLATFORM_DEFAULT_RUN_BUDGET = {
  max_usd: 1,
  max_tokens: 100_000,
} as const;

/** Current platform rate card id (DO8). */
export const PLATFORM_RATE_CARD_VERSION = "2026-07-19.v2" as const;

/** Aggregated run cost for API / Timeline (DO3a · DO10) — always derived from llm_usages. */
export type RunCostSummary = {
  run_id: UlidOrUuid;
  pricing_version: string | null;
  max_usd: number | null;
  max_tokens: number | null;
  spent_usd: number;
  spent_tokens: number;
  remaining_usd: number | null;
  remaining_tokens: number | null;
  call_count: number;
};
