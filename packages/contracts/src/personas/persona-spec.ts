import type { ModelProfileId } from "../common/model-profiles.js";
import type { SemVer } from "../common/primitives.js";

export type PersonaRuleSeverity = "must" | "should" | "must_not";

export type PersonaSafetyProfile = "standard" | "strict";

export interface PersonaPersonality {
  traits: string[];
  bio?: string;
}

export interface PersonaTone {
  formality?: string;
  language?: string;
  voice?: string;
}

export interface PersonaStyle {
  structure?: string;
  length?: string;
  formatting?: string;
}

export interface PersonaRule {
  id: string;
  severity: PersonaRuleSeverity;
  text: string;
}

export interface PersonaMemoryPolicy {
  read_scopes: string[];
  write_scopes: string[];
  pin_policy?: string;
}

export interface PersonaModelProfiles {
  default: ModelProfileId;
  overrides?: Record<string, ModelProfileId>;
}

export interface PersonaSpec {
  id: string;
  version: SemVer;
  /** Null when the persona is portable across agents. */
  agent_id: string | null;
  personality: PersonaPersonality;
  tone: PersonaTone;
  style: PersonaStyle;
  rules: PersonaRule[];
  memory: PersonaMemoryPolicy;
  tools: string[];
  skills: string[];
  model_profiles: PersonaModelProfiles;
  locale: string;
  safety_profile: PersonaSafetyProfile;
}
