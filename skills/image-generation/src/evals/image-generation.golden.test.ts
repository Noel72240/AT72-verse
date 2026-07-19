/**
 * Golden smoke eval for skill.image-generation (Phase 23 / DQ10).
 * Default path does not call image-generate (grant disabled by default).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createKernelClient } from "@at72-verse/verse-kernel";
import { execute, IMAGE_GENERATION_SKILL_SPEC, SKILL_ID } from "../index.js";

describe("skill.image-generation golden (Phase 23)", () => {
  it("exports SkillSpec with creative-balanced profile", () => {
    assert.equal(SKILL_ID, "skill.image-generation");
    assert.equal(IMAGE_GENERATION_SKILL_SPEC.default_model_profile, "creative-balanced");
  });

  it("execute returns prompt brief without side-effect tool by default", async () => {
    const kernel = createKernelClient({
      backend: "stub",
      context: {
        run_id: "11111111-1111-4111-8111-111111111111",
        agent_id: "eval",
        organization_id: "22222222-2222-4222-8222-222222222222",
        workspace_id: "33333333-3333-4333-8333-333333333333",
        trace_id: "55555555-5555-4555-8555-555555555555",
        user_id: null,
      },
    });

    let toolCalled = false;
    const original = kernel.tools.execute.bind(kernel.tools);
    kernel.tools.execute = async (req) => {
      toolCalled = true;
      return original(req);
    };

    const output = await execute({
      kernel,
      input: { brief: "Hero visual for AT72 Verse launch", style: "minimal" },
    });

    assert.equal(typeof output.content, "string");
    assert.equal(typeof output.prompt, "string");
    assert.equal(toolCalled, false);
  });
});
