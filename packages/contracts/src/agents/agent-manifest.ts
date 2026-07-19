import type { ModelProfileId } from "../common/model-profiles.js";
import type { SemVer } from "../common/primitives.js";

export type AgentKind = "orchestrator" | "specialist" | "utility";

export interface AgentConstraints {
  max_tokens_per_run: number;
  max_tool_calls: number;
  max_skill_invocations: number;
  timeout_ms: number;
}

export interface AgentRoutingHints {
  keywords?: string[];
  skill_tags?: string[];
  priority?: number;
}

export interface AgentUiMeta {
  avatar?: string;
  color_token?: string;
  short_label?: string;
}

export interface AgentPackageRef {
  kind: "agent";
  package_id?: string;
}

export interface AgentManifest {
  id: string;
  name: string;
  version: SemVer;
  role: string;
  description: string;
  kind: AgentKind;
  default_persona: string;
  skills: string[];
  tools_allowlist: string[];
  memory_scopes: string[];
  default_model_profile: ModelProfileId;
  constraints: AgentConstraints;
  routing_hints?: AgentRoutingHints;
  can_consult?: string[];
  ui?: AgentUiMeta;
  package?: AgentPackageRef;
}
