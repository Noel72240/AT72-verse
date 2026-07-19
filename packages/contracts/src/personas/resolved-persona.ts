import type { PersonaSpec } from "./persona-spec.js";

/** Partial patch applied on top of a PersonaSpec (org/workspace overrides). */
export type PersonaSpecPatch = {
  personality?: Partial<PersonaSpec["personality"]>;
  tone?: Partial<PersonaSpec["tone"]>;
  style?: Partial<PersonaSpec["style"]>;
  rules?: PersonaSpec["rules"];
  memory?: Partial<PersonaSpec["memory"]>;
  tools?: PersonaSpec["tools"];
  skills?: PersonaSpec["skills"];
  model_profiles?: Partial<PersonaSpec["model_profiles"]>;
  locale?: string;
  safety_profile?: PersonaSpec["safety_profile"];
};

export type PersonaMergeLayer = "system" | "agent" | "organization" | "workspace";

export type PersonaProvenanceEntry = {
  layer: PersonaMergeLayer;
  /** Present for agent seed / override identity. */
  source_id?: string;
  /** Dot-paths or field names that this layer changed. */
  contributed_fields: string[];
};

/**
 * Immutable persona snapshot for a run/step (Phase 17 / DC1).
 * Official personality actually used during execution.
 */
export type ResolvedPersona = {
  agent_id: string;
  /** Base first-party persona id (e.g. persona.nova.default). */
  persona_id: string;
  version: string;
  spec: PersonaSpec;
  provenance: {
    layers: PersonaProvenanceEntry[];
  };
};
