import type { ModelProfileId } from "../common/model-profiles.js";
import type { SemVer } from "../common/primitives.js";

/**
 * JSON Schema document reference (draft-07 / 2020-12 object).
 * Kept loose at freeze v0 — full schema documents live beside skills later.
 */
export type JsonSchema = Record<string, unknown>;

export interface SkillSpec {
  id: string;
  version: SemVer;
  name: string;
  description: string;
  input_schema: JsonSchema;
  output_schema: JsonSchema;
  required_tools?: string[];
  optional_tools?: string[];
  default_model_profile?: ModelProfileId;
  persona_hints?: {
    prefer_style?: string;
  };
  tags?: string[];
  eval_suite?: string;
  permissions?: string[];
}
