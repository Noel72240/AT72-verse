/**
 * Golden smoke eval for skill.writing (Phase 14 / BI1).
 * Uses stub Kernel — no network. Asserts schema-valid I/O shape.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createKernelClient } from "@at72-verse/verse-kernel";
import { execute, SKILL_ID, WRITING_SKILL_SPEC } from "../index.js";

const GOLDEN_BRIEF = "Write a short LinkedIn post announcing AT72 Verse Phase 14 skills.";

describe("skill.writing golden (BI1)", () => {
  it("exports marketplace SkillSpec with creative-balanced profile", () => {
    assert.equal(SKILL_ID, "skill.writing");
    assert.equal(WRITING_SKILL_SPEC.version, "0.1.1");
    assert.equal(WRITING_SKILL_SPEC.default_model_profile, "creative-balanced");
  });

  it("execute returns schema-valid content via Kernel.llm.complete", async () => {
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

    const output = await execute({
      kernel,
      input: { brief: GOLDEN_BRIEF, format: "linkedin_post" },
    });

    assert.equal(typeof output.content, "string");
    assert.ok(String(output.content).length > 0);
  });

  it("rejects invalid input before LLM", async () => {
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

    await assert.rejects(() => execute({ kernel, input: {} }));
  });
});
