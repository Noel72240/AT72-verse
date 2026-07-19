import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BusMessage } from "@at72-verse/contracts";
import { createKernelClient } from "@at72-verse/verse-kernel";
import {
  handleTask,
  ORION_AGENT_ID,
  ORION_ANALYSIS_SKILL_ID,
  ORION_PLAN,
} from "./index.js";

describe("agent-orion Phase 23", () => {
  it("handleTask invokes skill.analysis via Kernel", async () => {
    const kernel = createKernelClient({
      backend: "stub",
      context: {
        run_id: "11111111-1111-4111-8111-111111111111",
        agent_id: ORION_AGENT_ID,
        organization_id: "22222222-2222-4222-8222-222222222222",
        workspace_id: "33333333-3333-4333-8333-333333333333",
        trace_id: "55555555-5555-4555-8555-555555555555",
        user_id: null,
      },
    });

    kernel.skills.invoke = async (request) => {
      assert.equal(request.skill_id, ORION_ANALYSIS_SKILL_ID);
      return {
        output: { content: "Orion unit stub", insights: ["insight-1"] },
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
        goal: "Analyse Verse competitors",
      },
    };

    const out = await handleTask({ kernel, message });
    assert.deepEqual(out.plan, ORION_PLAN);
    assert.equal(out.result?.content, "Orion unit stub");
    assert.equal(out.resolved_persona?.agent_id, ORION_AGENT_ID);
  });
});
