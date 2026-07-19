/**
 * Phase 13 — Managed LLM pipeline (fake provider, no network).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createBus, llmTopic, type InMemoryBus } from "@at72-verse/bus";
import { KernelError } from "@at72-verse/verse-kernel";
import { createNoopAdapters } from "../adapters/noop.js";
import { buildBudgetSnapshot } from "../cost/cost-engine.js";
import { createVerseCore } from "../create-verse-core.js";
import { buildPackagesSnapshotFromSeeds } from "../registry/package-install-gate.js";
import { ManagedLlmAdapter } from "./managed-llm-adapter.js";
import { mapProviderError } from "./map-provider-error.js";
import { resolveModelRoute } from "./model-router.js";
import type { LlmProviderAdapter, ProviderCompleteInput } from "./provider-port.js";

const fixedContext = {
  run_id: "11111111-1111-4111-8111-111111111111",
  agent_id: "harness",
  organization_id: "22222222-2222-4222-8222-222222222222",
  workspace_id: "33333333-3333-4333-8333-333333333333",
  trace_id: "55555555-5555-4555-8555-555555555555",
  user_id: null as string | null,
  budget_snapshot: buildBudgetSnapshot({
    organization_id: "22222222-2222-4222-8222-222222222222",
    workspace_id: "33333333-3333-4333-8333-333333333333",
    run_id: "11111111-1111-4111-8111-111111111111",
    captured_at: "2026-07-19T12:00:00.000Z",
  }),
  packages_snapshot: buildPackagesSnapshotFromSeeds(
    "22222222-2222-4222-8222-222222222222",
    { captured_at: "2026-07-19T12:00:00.000Z" },
  ),
};

class FakeProvider implements LlmProviderAdapter {
  readonly id = "openai";
  lastInput: ProviderCompleteInput | undefined;

  async complete(input: ProviderCompleteInput) {
    this.lastInput = input;
    return {
      content: `echo:${input.messages.map((m) => m.content).join("|")}`,
      input_tokens: 3,
      output_tokens: 5,
    };
  }
}

describe("Phase 13 LLM Core", () => {
  it("routes known Model Profiles including analytic-strict", () => {
    assert.equal(resolveModelRoute("fast-cheap").model, "gpt-5.4-nano");
    assert.equal(resolveModelRoute("orchestrate-precise").provider, "openai");
    assert.equal(resolveModelRoute("creative-balanced").model, "gpt-5.4-nano");
    assert.equal(resolveModelRoute("analytic-strict").model, "gpt-5.4-nano");
    assert.throws(
      () => resolveModelRoute("unknown-profile"),
      (err: unknown) => {
        assert.ok(err instanceof KernelError);
        assert.equal(err.code, "INVALID_INPUT");
        return true;
      },
    );
  });

  it("complete publishes llm.usage.recorded with profile, run_id, trace_id, llm_call_id", async () => {
    const bus = createBus({ backend: "memory" }) as InMemoryBus;
    const fake = new FakeProvider();
    const llm = new ManagedLlmAdapter({
      bus,
      provider: fake,
      credentials: { platformApiKey: "test-key" },
    });
    const adapters = { ...createNoopAdapters(), llm };
    const core = createVerseCore({ adapters, bus, kernelBackend: "core" });
    const kernel = core.createKernelClient({
      ...fixedContext,
      tenant_id: fixedContext.organization_id,
      span_id: "66666666-6666-4666-8666-666666666666",
    });

    const result = await kernel.llm.complete({
      profile: "fast-cheap",
      messages: [{ role: "user", content: "ping" }],
    });

    assert.ok(result.llm_call_id);
    assert.equal(result.usage.credential_source, "platform");
    assert.equal(result.content, "echo:ping");
    assert.equal(fake.lastInput?.context.run_id, fixedContext.run_id);
    assert.equal(fake.lastInput?.context.trace_id, fixedContext.trace_id);
    assert.equal(fake.lastInput?.llm_call_id, result.llm_call_id);

    const usages = bus.getPublished(llmTopic("usage"));
    assert.equal(usages.length, 1);
    const msg = usages[0]!;
    assert.equal(msg.event_type, "llm.usage.recorded");
    assert.equal(msg.run_id, fixedContext.run_id);
    assert.equal(msg.payload.profile, "fast-cheap");
    assert.equal(msg.payload.llm_call_id, result.llm_call_id);
    assert.equal(msg.payload.trace_id, fixedContext.trace_id);
    assert.equal(msg.payload.credential_source, "platform");
    assert.equal(msg.payload.model, "gpt-5.4-nano");
    assert.equal(typeof msg.payload.estimated_usd, "number");
    assert.ok(String(msg.payload.pricing_version).length > 0);
  });

  it("stream is UNAVAILABLE; embed is available (Phase 25)", async () => {
    const bus = createBus({ backend: "memory" });
    const core = createVerseCore({
      bus,
      llmMode: "noop",
      kernelBackend: "core",
    });
    const kernel = core.createKernelClient({
      ...fixedContext,
      tenant_id: fixedContext.organization_id,
      span_id: "66666666-6666-4666-8666-666666666666",
    });

    await assert.rejects(
      async () => {
        for await (const _ of kernel.llm.stream({
          profile: "fast-cheap",
          messages: [{ role: "user", content: "x" }],
        })) {
          /* empty */
        }
      },
      (err: unknown) => err instanceof KernelError && err.code === "UNAVAILABLE",
    );

    const embedded = await kernel.llm.embed({ profile: "fast-cheap", input: "tone of voice" });
    assert.ok(Array.isArray(embedded.vectors));
    assert.ok(embedded.vectors[0]!.length > 0);
  });

  it("mapProviderError never leaks SDK message text", () => {
    const err = mapProviderError(
      Object.assign(new Error("sk-secret-key-in-message"), { status: 401 }),
      "openai",
    );
    assert.equal(err.code, "AUTH");
    assert.equal(err.message.includes("sk-secret"), false);
    assert.equal(err.message.includes("openai"), true);
  });
});
