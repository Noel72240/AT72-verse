/**
 * Model Profile identifiers (Phase 13 / AT1 · AT3).
 * Routing profile → provider/model is Core-only — never in agents.
 *
 * `ModelProfileId` stays an open string for manifests (future profiles).
 * Only `ROUTED_MODEL_PROFILE_IDS` are accepted by the Core Model Router (Phase 13+).
 */
export const ROUTED_MODEL_PROFILE_IDS = [
  "fast-cheap",
  "orchestrate-precise",
  "creative-balanced",
  "analytic-strict",
] as const;

/** Profiles the Phase 13 Model Router knows how to map. */
export type RoutedModelProfileId = (typeof ROUTED_MODEL_PROFILE_IDS)[number];

/** Any profile id in contracts / manifests (open set). */
export type ModelProfileId = RoutedModelProfileId | (string & {});

export function isRoutedModelProfileId(value: string): value is RoutedModelProfileId {
  return (ROUTED_MODEL_PROFILE_IDS as readonly string[]).includes(value);
}

/** @deprecated Alias — prefer ROUTED_MODEL_PROFILE_IDS */
export const MODEL_PROFILE_IDS = ROUTED_MODEL_PROFILE_IDS;
/** @deprecated Alias — prefer isRoutedModelProfileId */
export const isModelProfileId = isRoutedModelProfileId;
