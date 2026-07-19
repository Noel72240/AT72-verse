/**
 * Cost Engine unit tests (Phase 21 / DO12).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { KernelContext } from "@at72-verse/contracts";
import { PLATFORM_RATE_CARD_VERSION } from "@at72-verse/contracts";
import { KernelError } from "@at72-verse/verse-kernel";
import { buildBudgetSnapshot, CostEngine } from "./cost-engine.js";
import { estimateTokensUsd } from "./rate-card.js";

const ORG = "44444444-4444-4444-8444-444444444444";
const WS = "55555555-5555-4555-8555-555555555555";
const RUN = "11111111-1111-4111-8111-111111111111";

function ctx(partial: Partial<KernelContext> = {}): KernelContext {
  const snapshot =
    partial.budget_snapshot === undefined
      ? buildBudgetSnapshot({
          organization_id: ORG,
          workspace_id: WS,
          run_id: RUN,
          max_usd: 1,
          max_tokens: 1000,
          captured_at: "2026-07-19T12:00:00.000Z",
        })
      : partial.budget_snapshot;
  return {
    run_id: partial.run_id ?? RUN,
    trace_id: partial.trace_id ?? "22222222-2222-4222-8222-222222222222",
    span_id: partial.span_id ?? "33333333-3333-4333-8333-333333333333",
    agent_id: partial.agent_id ?? "adam",
    organization_id: ORG,
    tenant_id: ORG,
    workspace_id: WS,
    user_id: null,
    budget_snapshot: snapshot,
  };
}

describe("CostEngine Phase 21", () => {
  it("estimate is deterministic for identical inputs", () => {
    const engine = new CostEngine();
    const a = engine.estimate("fast-cheap", 1000);
    const b = engine.estimate("fast-cheap", 1000);
    assert.deepEqual(a, b);
  });

  it("same token scenario always yields same estimated_usd (Rate Card)", () => {
    const a = estimateTokensUsd({
      model: "gpt-4o-mini",
      input_tokens: 100,
      output_tokens: 50,
    });
    const b = estimateTokensUsd({
      model: "gpt-4o-mini",
      input_tokens: 100,
      output_tokens: 50,
    });
    assert.deepEqual(a, b);
    assert.equal(a.pricing_version, PLATFORM_RATE_CARD_VERSION);
  });

  it("getBudget decreases after recordLlmUsage", () => {
    const engine = new CostEngine();
    const context = ctx();
    const before = engine.getBudget(context);
    assert.equal(before.remaining_tokens, 1000);
    engine.recordLlmUsage({
      context,
      model: "gpt-4o-mini",
      input_tokens: 100,
      output_tokens: 50,
    });
    const after = engine.getBudget(context);
    assert.equal(after.remaining_tokens, 850);
    assert.ok(after.remaining_usd < before.remaining_usd);
  });

  it("hard-stop when budget exhausted before call", () => {
    const engine = new CostEngine();
    const context = ctx({
      budget_snapshot: buildBudgetSnapshot({
        organization_id: ORG,
        workspace_id: WS,
        run_id: RUN,
        max_usd: 1,
        max_tokens: 10,
        captured_at: "2026-07-19T12:00:00.000Z",
      }),
    });
    engine.recordLlmUsage({
      context,
      model: "gpt-4o-mini",
      input_tokens: 5,
      output_tokens: 5,
    });
    assert.throws(
      () => engine.assertCanStartLlmCall(context),
      (err: unknown) => err instanceof KernelError && err.code === "BUDGET_EXCEEDED",
    );
  });

  it("post-check throws when a call exceeds max_tokens", () => {
    const engine = new CostEngine();
    const context = ctx({
      budget_snapshot: buildBudgetSnapshot({
        organization_id: ORG,
        workspace_id: WS,
        run_id: RUN,
        max_usd: 10,
        max_tokens: 20,
        captured_at: "2026-07-19T12:00:00.000Z",
      }),
    });
    assert.throws(
      () =>
        engine.recordLlmUsage({
          context,
          model: "gpt-4o-mini",
          input_tokens: 15,
          output_tokens: 15,
        }),
      (err: unknown) => err instanceof KernelError && err.code === "BUDGET_EXCEEDED",
    );
  });

  it("missing budget_snapshot is refused", () => {
    const engine = new CostEngine();
    const context = ctx({ budget_snapshot: null });
    assert.throws(
      () => engine.getBudget(context),
      (err: unknown) => err instanceof KernelError && err.code === "BUDGET_EXCEEDED",
    );
  });

  it("Adam and Nova share the same run ledger", () => {
    const engine = new CostEngine();
    const adam = ctx({ agent_id: "adam" });
    const nova = ctx({ agent_id: "nova" });
    engine.recordLlmUsage({
      context: adam,
      model: "gpt-4o",
      input_tokens: 10,
      output_tokens: 10,
    });
    engine.recordLlmUsage({
      context: nova,
      model: "gpt-4o-mini",
      input_tokens: 10,
      output_tokens: 10,
    });
    const spent = engine.getSpent(RUN);
    assert.equal(spent?.spent_tokens, 40);
  });

  it("runExclusive serializes concurrent work for the same run_id (Phase 24 / DR8)", async () => {
    const engine = new CostEngine();
    const order: number[] = [];
    await Promise.all([
      engine.runExclusive(RUN, async () => {
        order.push(1);
        await new Promise((r) => setTimeout(r, 20));
        order.push(2);
      }),
      engine.runExclusive(RUN, async () => {
        order.push(3);
        order.push(4);
      }),
    ]);
    assert.deepEqual(order, [1, 2, 3, 4]);
  });
});
