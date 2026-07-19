import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PersonaSpec } from "@at72-verse/contracts";
import { mergePersonaLayers } from "./persona-engine.js";

const agentPersona: PersonaSpec = {
  id: "persona.nova.default",
  version: "0.1.0",
  agent_id: "nova",
  personality: { traits: ["clair"] },
  tone: { formality: "tutoiement", language: "fr-FR" },
  style: {},
  rules: [],
  memory: { read_scopes: [], write_scopes: [] },
  tools: [],
  skills: [],
  model_profiles: { default: "creative-balanced" },
  locale: "fr-FR",
  safety_profile: "standard",
};

describe("PersonaEngine merge (Phase 17)", () => {
  it("is deterministic for identical inputs", () => {
    const a = mergePersonaLayers({
      agentId: "nova",
      agentPersona,
      organization: { tone: { voice: "premium" } },
      workspace: { tone: { formality: "vouvoiement" } },
    });
    const b = mergePersonaLayers({
      agentId: "nova",
      agentPersona,
      organization: { tone: { voice: "premium" } },
      workspace: { tone: { formality: "vouvoiement" } },
    });
    assert.equal(JSON.stringify(a), JSON.stringify(b));
  });

  it("records provenance layers system → agent → organization → workspace", () => {
    const resolved = mergePersonaLayers({
      agentId: "nova",
      agentPersona,
      organization: { tone: { voice: "calm" } },
      workspace: { tone: { formality: "vouvoiement" } },
    });
    const layers = resolved.provenance.layers.map((l) => l.layer);
    assert.deepEqual(layers, ["system", "agent", "organization", "workspace"]);
    assert.ok(
      resolved.provenance.layers
        .find((l) => l.layer === "workspace")
        ?.contributed_fields.some((f) => f.includes("formality")),
    );
  });

  it("workspace override wins for formality over org and agent", () => {
    const resolved = mergePersonaLayers({
      agentId: "nova",
      agentPersona,
      organization: { tone: { formality: "tutoiement" } },
      workspace: { tone: { formality: "vouvoiement" } },
    });
    assert.equal(resolved.spec.tone.formality, "vouvoiement");
  });
});
