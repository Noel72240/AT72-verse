/**
 * Core Model Router (Phase 13 / AT1 · AT3 · Phase 14 / BF1).
 * Maps profile → provider/model. Agents never see this table.
 */
import type { RoutedModelProfileId } from "@at72-verse/contracts";
import { isRoutedModelProfileId } from "@at72-verse/contracts";
import { KernelError } from "@at72-verse/verse-kernel";

export type ModelRoute = {
  profile: RoutedModelProfileId;
  provider: "openai";
  model: string;
};

const ROUTES: Record<RoutedModelProfileId, ModelRoute> = {
  "fast-cheap": {
    profile: "fast-cheap",
    provider: "openai",
    model: "gpt-4o-mini",
  },
  "orchestrate-precise": {
    profile: "orchestrate-precise",
    provider: "openai",
    model: "gpt-4o",
  },
  "creative-balanced": {
    profile: "creative-balanced",
    provider: "openai",
    model: "gpt-4o",
  },
  "analytic-strict": {
    profile: "analytic-strict",
    provider: "openai",
    model: "gpt-4o",
  },
};

export function resolveModelRoute(profile: string): ModelRoute {
  if (!isRoutedModelProfileId(profile)) {
    throw new KernelError("INVALID_INPUT", `Unknown or unsupported Model Profile: ${profile}`, {
      details: { profile, supported: Object.keys(ROUTES) },
    });
  }
  return ROUTES[profile];
}
