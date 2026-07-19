/**
 * Golden smoke eval for skill.analysis (Phase 23 / DQ10).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createKernelClient } from "@at72-verse/verse-kernel";
import { ANALYSIS_SKILL_SPEC, execute, SKILL_ID } from "../index.js";

describe("skill.analysis golden (Phase 23)", () => {
  it("exports marketplace SkillSpec with analytic-strict profile", () => {
    assert.equal(SKILL_ID, "skill.analysis");
    assert.equal(ANALYSIS_SKILL_SPEC.default_model_profile, "analytic-strict");
  });

  it("execute returns schema-valid insights via Kernel.llm.complete", async () => {
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
      input: { brief: "Analyse the competitive landscape for AT72 Verse.", focus: "market" },
    });

    assert.equal(typeof output.content, "string");
    assert.ok(String(output.content).length > 0);
    assert.ok(Array.isArray(output.insights));
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
