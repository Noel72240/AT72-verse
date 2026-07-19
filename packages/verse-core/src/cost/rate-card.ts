/**
 * Platform Rate Card (Phase 21 / DO8).
 * Deterministic USD estimates — no external billing API.
 */
import { PLATFORM_RATE_CARD_VERSION } from "@at72-verse/contracts";
import { resolveModelRoute } from "../llm/model-router.js";

/** USD per 1_000 tokens (input / output), keyed by provider model id. */
export type ModelTokenRates = {
  input_per_1k_usd: number;
  output_per_1k_usd: number;
};

/**
 * Fixed rates for reproducibility (tests must get identical totals).
 * Approximate public list prices — not live market data.
 */
const MODEL_RATES: Record<string, ModelTokenRates> = {
  "gpt-4o-mini": { input_per_1k_usd: 0.00015, output_per_1k_usd: 0.0006 },
  "gpt-4o": { input_per_1k_usd: 0.0025, output_per_1k_usd: 0.01 },
  "text-embedding-3-small": { input_per_1k_usd: 0.00002, output_per_1k_usd: 0 },
};

const FALLBACK_RATES: ModelTokenRates = {
  input_per_1k_usd: 0.001,
  output_per_1k_usd: 0.002,
};

export function getRateCardVersion(): string {
  return PLATFORM_RATE_CARD_VERSION;
}

export function ratesForModel(model: string): ModelTokenRates {
  return MODEL_RATES[model] ?? FALLBACK_RATES;
}

/** Round to 6 decimal places (stable display / persistence). */
export function roundUsd(value: number): number {
  return Number(value.toFixed(6));
}

export function estimateTokensUsd(input: {
  model: string;
  input_tokens: number;
  output_tokens: number;
}): { estimated_usd: number; pricing_version: string } {
  const rates = ratesForModel(input.model);
  const usd =
    (input.input_tokens / 1000) * rates.input_per_1k_usd +
    (input.output_tokens / 1000) * rates.output_per_1k_usd;
  return {
    estimated_usd: roundUsd(usd),
    pricing_version: getRateCardVersion(),
  };
}

/**
 * Kernel.cost.estimate — approxTokens treated as 50/50 input/output on the profile model.
 */
export function estimateProfileApproxUsd(profile: string, approxTokens: number): number {
  const route = resolveModelRoute(profile);
  const half = Math.max(0, Math.floor(approxTokens / 2));
  const rest = Math.max(0, approxTokens - half);
  return estimateTokensUsd({
    model: route.model,
    input_tokens: half,
    output_tokens: rest,
  }).estimated_usd;
}
