import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BusMessage } from "@at72-verse/contracts";
import { createKernelClient } from "@at72-verse/verse-kernel";
import { ASTRA_AGENT_ID, ASTRA_PLAN, ASTRA_SEO_SKILL_ID, handleTask } from "./index.js";

describe("agent-astra Phase 23", () => {
  it("handleTask invokes skill.seo via Kernel", async () => {
    const kernel = createKernelClient({
      backend: "stub",
      context: {
        run_id: "11111111-1111-4111-8111-111111111111",
        agent_id: ASTRA_AGENT_ID,
        organization_id: "22222222-2222-4222-8222-222222222222",
        workspace_id: "33333333-3333-4333-8333-333333333333",
        trace_id: "55555555-5555-4555-8555-555555555555",
        user_id: null,
      },
    });

    kernel.skills.invoke = async (request) => {
      assert.equal(request.skill_id, ASTRA_SEO_SKILL_ID);
      return {
        output: {
          content: "Astra unit stub",
          score: 80,
          recommendations: ["Improve meta"],
        },
      };
    };

    const message: BusMessage = {
      event_id: "e1",
      correlation_id: "55555555-5555-4555-8555-555555555555",
      causation_id: "e0",
      tenant_id: "22222222-2222-4222-8222-222222222222",
      workspace_id: "33333333-3333-4333-8333-333333333333",
      run_id: "11111111-1111-4111-8111-111111111111",
      timestamp: new Date().toISOString(),
      version: "1",
      event_type: "agent.task",
      payload: {
        run_id: "11111111-1111-4111-8111-111111111111",
        trace_id: "55555555-5555-4555-8555-555555555555",
        goal: "SEO audit homepage",
        url: "https://example.com/",
      },
    };

    const out = await handleTask({ kernel, message });
    assert.deepEqual(out.plan, ASTRA_PLAN);
    assert.equal(out.result?.content, "Astra unit stub");
    assert.equal(out.resolved_persona?.agent_id, ASTRA_AGENT_ID);
  });
});
