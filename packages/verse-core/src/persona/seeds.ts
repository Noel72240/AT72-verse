/**
 * First-party persona seeds (Phase 17 / DH1 · ADR-010 · Phase 23 / DQ7).
 * Canonical copies also live in repo `/personas` — keep in sync.
 */
import type { PersonaSpec } from "@at72-verse/contracts";
import adamDefault from "./seeds/persona.adam.default.json" with { type: "json" };
import astraDefault from "./seeds/persona.astra.default.json" with { type: "json" };
import novaDefault from "./seeds/persona.nova.default.json" with { type: "json" };
import orionDefault from "./seeds/persona.orion.default.json" with { type: "json" };
import pixelDefault from "./seeds/persona.pixel.default.json" with { type: "json" };

/** Minimal platform base merged first (deterministic). */
export const SYSTEM_PERSONA_BASE: PersonaSpec = {
  id: "persona.system.base",
  version: "0.1.0",
  agent_id: null,
  personality: { traits: [] },
  tone: {},
  style: {},
  rules: [],
  memory: { read_scopes: [], write_scopes: [] },
  tools: [],
  skills: [],
  model_profiles: { default: "fast-cheap" },
  locale: "fr-FR",
  safety_profile: "standard",
};

export const FIRST_PARTY_PERSONAS: ReadonlyMap<string, PersonaSpec> = new Map([
  [(adamDefault as PersonaSpec).id, adamDefault as PersonaSpec],
  [(novaDefault as PersonaSpec).id, novaDefault as PersonaSpec],
  [(orionDefault as PersonaSpec).id, orionDefault as PersonaSpec],
  [(astraDefault as PersonaSpec).id, astraDefault as PersonaSpec],
  [(pixelDefault as PersonaSpec).id, pixelDefault as PersonaSpec],
]);
