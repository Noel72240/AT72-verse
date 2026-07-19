/**
 * Core Model Router (Phase 13 / AT1 · AT3 · Phase 14 / BF1).
 * Maps profile → provider/model. Agents never see this table.
 *
 * Override via Railway env (optional):
 *   VERSE_LLM_MODEL_FAST=gpt-5.4-mini
 *   VERSE_LLM_MODEL_QUALITY=gpt-5.5
 */
import type { RoutedModelProfileId } from "@at72-verse/contracts";
import { isRoutedModelProfileId } from "@at72-verse/contracts";
import { KernelError } from "@at72-verse/verse-kernel";

export type ModelRoute = {
  profile: RoutedModelProfileId;
  provider: "openai";
  model: string;
};

function envModel(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value && value.length > 0 ? value : fallback;
}

function buildRoutes(): Record<RoutedModelProfileId, ModelRoute> {
  const fast = envModel("VERSE_LLM_MODEL_FAST", "gpt-5.4-mini");
  const quality = envModel("VERSE_LLM_MODEL_QUALITY", "gpt-5.5");
  return {
    "fast-cheap": {
      profile: "fast-cheap",
      provider: "openai",
      model: fast,
    },
    "orchestrate-precise": {
      profile: "orchestrate-precise",
      provider: "openai",
      model: quality,
    },
    "creative-balanced": {
      profile: "creative-balanced",
      provider: "openai",
      model: quality,
    },
    "analytic-strict": {
      profile: "analytic-strict",
      provider: "openai",
      model: quality,
    },
  };
}

export function resolveModelRoute(profile: string): ModelRoute {
  if (!isRoutedModelProfileId(profile)) {
    throw new KernelError("INVALID_INPUT", `Unknown or unsupported Model Profile: ${profile}`, {
      details: { profile, supported: Object.keys(buildRoutes()) },
    });
  }
  return buildRoutes()[profile];
}
