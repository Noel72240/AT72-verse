/**
 * Workflow Engine unit tests (Phase 26).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createKernelClient } from "@at72-verse/verse-kernel";
import {
  CONTENT_CAMPAIGN_DEFINITION,
  WorkflowEngine,
} from "./workflow-engine.js";

function kernelForWorkflow() {
  return createKernelClient({
    backend: "stub",
    context: {
      run_id: "11111111-1111-4111-8111-111111111111",
      agent_id: "workflow-engine",
      organization_id: "22222222-2222-4222-8222-222222222222",
      workspace_id: "33333333-3333-4333-8333-333333333333",
      trace_id: "55555555-5555-4555-8555-555555555555",
      step_id: "44444444-4444-4444-8444-444444444444",
    },
  });
}

describe("WorkflowEngine Phase 26", () => {
  it("content-campaign pauses at checkpoint with deterministic aggregate keys", async () => {
    const engine = new WorkflowEngine();
    const state = await engine.advance({
      kernel: kernelForWorkflow(),
      definition: CONTENT_CAMPAIGN_DEFINITION,
      input: { brief: "Launch campaign for Verse" },
    });
    assert.equal(state.status, "waiting_checkpoint");
    assert.ok(state.completed_step_ids.includes("ingest_brief"));
    assert.ok(state.completed_step_ids.includes("specialists"));
    assert.ok(state.completed_step_ids.includes("review_gate"));
    assert.ok(!state.completed_step_ids.includes("finalize"));
    const specialists = state.step_outputs.specialists as {
      aggregate?: Record<string, unknown>;
    };
    assert.deepEqual(Object.keys(specialists.aggregate ?? {}), ["nova", "astra", "pixel"]);
  });

  it("resume after checkpoint completes finalize (no auto-retry)", async () => {
    const engine = new WorkflowEngine();
    const kernel = kernelForWorkflow();
    const paused = await engine.advance({
      kernel,
      definition: CONTENT_CAMPAIGN_DEFINITION,
      input: { brief: "Resume me" },
    });
    assert.equal(paused.status, "waiting_checkpoint");

    const done = await engine.advance({
      kernel,
      definition: CONTENT_CAMPAIGN_DEFINITION,
      input: { brief: "Resume me" },
      state: paused,
    });
    assert.equal(done.status, "completed");
    assert.ok(done.completed_step_ids.includes("finalize"));
  });

  it("unknown step kind fails explicitly", async () => {
    const bad = await new WorkflowEngine().advance({
      kernel: kernelForWorkflow(),
      definition: {
        id: "bad",
        version: "0.0.1",
        display_name: "Bad",
        trigger: "manual",
        steps: [{ id: "z", kind: "not_a_real_kind" as "noop" }],
      },
      input: {},
    });
    assert.equal(bad.status, "failed");
    assert.match(String(bad.error), /Unsupported workflow step kind/i);
  });

  it("registerHandler extends engine without rewrite", async () => {
    const engine = new WorkflowEngine();
    engine.registerHandler("condition", async () => ({ output: { branch: "then" } }));
    const state = await engine.advance({
      kernel: kernelForWorkflow(),
      definition: {
        id: "cond",
        version: "0.0.1",
        display_name: "Cond",
        trigger: "manual",
        steps: [{ id: "c", kind: "condition" as "noop" }],
      },
      input: {},
    });
    assert.equal(state.status, "completed");
    assert.deepEqual(state.step_outputs.c, { branch: "then" });
  });
});
