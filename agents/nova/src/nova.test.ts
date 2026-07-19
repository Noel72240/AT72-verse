import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BusMessage } from "@at72-verse/contracts";
import { createKernelClient } from "@at72-verse/verse-kernel";
import { handleTask, NOVA_AGENT_ID, NOVA_PLAN, NOVA_WRITING_SKILL_ID } from "./index.js";

describe("agent-nova Phase 14", () => {
  it("handleTask invokes skill.writing via Kernel and returns plan + result", async () => {
    const kernel = createKernelClient({
      backend: "stub",
      context: {
        run_id: "11111111-1111-4111-8111-111111111111",
        agent_id: NOVA_AGENT_ID,
        organization_id: "22222222-2222-4222-8222-222222222222",
        workspace_id: "33333333-3333-4333-8333-333333333333",
        trace_id: "55555555-5555-4555-8555-555555555555",
        user_id: null,
      },
    });

    // Stub skills.invoke is noop echo — Nova unit test without Runtime skill host.
    // Replace skills temporarily for unit shape check.
    const originalInvoke = kernel.skills.invoke.bind(kernel.skills);
    kernel.skills.invoke = async (request) => {
      assert.equal(request.skill_id, NOVA_WRITING_SKILL_ID);
      assert.equal(typeof request.input.brief, "string");
      return { output: { content: "Nova unit stub content" } };
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
        goal: "Announce the writing skill",
      },
    };

    const out = await handleTask({ kernel, message });
    assert.deepEqual(out.plan, NOVA_PLAN);
    assert.equal(out.result?.content, "Nova unit stub content");
    assert.ok(out.resolved_persona);
    assert.equal(out.resolved_persona?.agent_id, NOVA_AGENT_ID);

    kernel.skills.invoke = originalInvoke;
  });
});
