/**
 * HITL approval store unit tests (Phase 29 idempotence).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { InMemoryApprovalStore } from "./approval-store-port.js";

describe("InMemoryApprovalStore Phase 29", () => {
  it("approve is single-flight pending→approved", async () => {
    const store = new InMemoryApprovalStore();
    const pending = await store.createPending({
      organization_id: "44444444-4444-4444-8444-444444444444",
      workspace_id: "55555555-5555-4555-8555-555555555555",
      run_id: "11111111-1111-4111-8111-111111111111",
      tool_id: "social-publish",
      agent_id: "pulse",
      input_snapshot: { mode: "live" },
      input_preview: { mode: "live" },
    });
    const [a, b] = await Promise.all([
      store.tryApprove(pending.id, "u1"),
      store.tryApprove(pending.id, "u2"),
    ]);
    const winners = [a, b].filter(Boolean);
    assert.equal(winners.length, 1);
    const row = await store.getById(pending.id);
    assert.equal(row?.status, "approved");
  });

  it("claimExecution is single-flight approved→executed", async () => {
    const store = new InMemoryApprovalStore();
    const pending = await store.createPending({
      organization_id: "44444444-4444-4444-8444-444444444444",
      workspace_id: "55555555-5555-4555-8555-555555555555",
      run_id: "11111111-1111-4111-8111-111111111111",
      tool_id: "social-publish",
      agent_id: "pulse",
      input_snapshot: { mode: "live" },
      input_preview: { mode: "live" },
    });
    await store.tryApprove(pending.id, "u1");
    const [a, b] = await Promise.all([
      store.tryClaimExecution(pending.id),
      store.tryClaimExecution(pending.id),
    ]);
    const winners = [a, b].filter(Boolean);
    assert.equal(winners.length, 1);
    const row = await store.getById(pending.id);
    assert.equal(row?.status, "executed");
    assert.ok(row?.executed_at);
  });
});
