/**
 * Golden smoke eval for skill.seo (Phase 23 / DQ10).
 * Stub Kernel tools.execute echoes — skill still validates I/O shape with patched tools.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createKernelClient } from "@at72-verse/verse-kernel";
import { execute, SEO_SKILL_SPEC, SKILL_ID } from "../index.js";

describe("skill.seo golden (Phase 23)", () => {
  it("exports SkillSpec with analytic-strict profile", () => {
    assert.equal(SKILL_ID, "skill.seo");
    assert.equal(SEO_SKILL_SPEC.default_model_profile, "analytic-strict");
  });

  it("execute returns schema-valid SEO output", async () => {
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

    kernel.tools.execute = async (request) => {
      assert.equal(request.tool_id, "seo-audit");
      return {
        execution_id: "exec-seo-stub",
        output: {
          score: 72,
          findings: ["Title OK", "Add meta description"],
          url: String(request.input.url ?? ""),
        },
      };
    };

    const output = await execute({
      kernel,
      input: {
        brief: "Audit homepage SEO for AT72 Verse",
        url: "https://example.com/verse",
      },
    });

    assert.equal(typeof output.content, "string");
    assert.equal(output.score, 72);
    assert.ok(Array.isArray(output.recommendations));
  });
});
