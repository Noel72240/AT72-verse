/**
 * Phase 13 / AX1 — prove Kernel → Core → Provider pipeline outside Adam.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createBus, llmTopic, type InMemoryBus } from "@at72-verse/bus";
import {
  buildBudgetSnapshot,
  buildPackagesSnapshotFromSeeds,
  createNoopAdapters,
  createVerseCore,
  ManagedLlmAdapter,
  type LlmProviderAdapter,
  type ProviderCompleteInput,
} from "@at72-verse/verse-core";
import { createKernelClient, KernelError } from "@at72-verse/verse-kernel";
import { startAgentRuntime } from "./runtime.js";

class FakeProvider implements LlmProviderAdapter {
  readonly id = "openai";
  async complete(input: ProviderCompleteInput) {
    return {
      content: `harness-ok:${input.llm_call_id.slice(0, 8)}`,
      input_tokens: 2,
      output_tokens: 4,
    };
  }
}

describe("agent-runtime Phase 13 LLM harness (AX1)", () => {
  it("Runtime hosts Core; llm.complete publishes usage — Adam remains unused", async () => {
    const bus = createBus({ backend: "memory" }) as InMemoryBus;
    const llm = new ManagedLlmAdapter({
      bus,
      provider: new FakeProvider(),
      credentials: { platformApiKey: "test-key" },
    });
    const core = createVerseCore({
      bus,
      adapters: { ...createNoopAdapters(), llm },
      kernelBackend: "core",
    });

    const runtime = await startAgentRuntime({
      bus,
      core,
      consumerGroup: "harness-runtime",
    });

    const runId = "11111111-1111-4111-8111-111111111111";
    const orgId = "22222222-2222-4222-8222-222222222222";
    const wsId = "33333333-3333-4333-8333-333333333333";
    const kernel = createKernelClient({
      backend: "core",
      coreFactory: (ctx) => runtime.core.createKernelClient(ctx),
      context: {
        run_id: runId,
        agent_id: "llm-harness",
        organization_id: orgId,
        workspace_id: wsId,
        trace_id: "55555555-5555-4555-8555-555555555555",
        user_id: null,
        budget_snapshot: buildBudgetSnapshot({
          organization_id: orgId,
          workspace_id: wsId,
          run_id: runId,
          captured_at: "2026-07-19T12:00:00.000Z",
        }),
        packages_snapshot: buildPackagesSnapshotFromSeeds(orgId, {
          captured_at: "2026-07-19T12:00:00.000Z",
        }),
      },
    });

    const completion = await kernel.llm.complete({
      profile: "orchestrate-precise",
      messages: [{ role: "user", content: "prove pipeline" }],
    });

    assert.ok(completion.llm_call_id);
    assert.match(completion.content, /^harness-ok:/);
    assert.equal(completion.usage.credential_source, "platform");

    const usages = bus.getPublished(llmTopic("usage"));
    assert.equal(usages.length, 1);
    assert.equal(usages[0]!.payload.profile, "orchestrate-precise");
    assert.equal(usages[0]!.payload.agent_id, "llm-harness");

    await assert.rejects(
      async () => {
        for await (const _ of kernel.llm.stream({
          profile: "fast-cheap",
          messages: [{ role: "user", content: "no" }],
        })) {
          /* empty */
        }
      },
      (e: unknown) => e instanceof KernelError && e.code === "UNAVAILABLE",
    );

    await runtime.stop();
  });
});
