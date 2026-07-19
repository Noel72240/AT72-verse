import type { RoutedModelProfileId } from "../common/model-profiles.js";
import type { UlidOrUuid } from "../common/primitives.js";

export type LlmCredentialSource = "platform" | "organization" | "workspace" | "agent";

/**
 * Bus payload for `llm.usage.recorded` (Phase 13 / AW2).
 * Published by Core after each LLM call; API persists — Core never owns domain storage.
 */
export interface LlmUsageRecordedPayload {
  llm_call_id: UlidOrUuid;
  run_id: UlidOrUuid;
  trace_id: UlidOrUuid;
  organization_id: UlidOrUuid;
  workspace_id: UlidOrUuid;
  agent_id: string;
  profile: RoutedModelProfileId;
  provider: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  credential_source: LlmCredentialSource;
  /** Deterministic USD estimate from Rate Card (Phase 21 / DO8). */
  estimated_usd: number;
  /** Rate card version used for estimated_usd (reproducibility). */
  pricing_version: string;
}
