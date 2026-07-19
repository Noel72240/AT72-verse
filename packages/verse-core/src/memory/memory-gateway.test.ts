/**
 * Memory Gateway unit tests (Phase 18).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { KernelContext } from "@at72-verse/contracts";
import { KernelError } from "@at72-verse/verse-kernel";
import { PersonaEngine } from "../persona/persona-engine.js";
import { DeterministicConversationSummarizer } from "./conversation-summarizer.js";
import { InMemoryMemoryStore } from "./in-memory-store.js";
import { InMemoryVectorIndex } from "./in-memory-vector-index.js";
import { MemoryGateway } from "./memory-gateway.js";

function ctx(partial: Partial<KernelContext> & Pick<KernelContext, "agent_id">): KernelContext {
  return {
    run_id: partial.run_id ?? "11111111-1111-4111-8111-111111111111",
    trace_id: partial.trace_id ?? "22222222-2222-4222-8222-222222222222",
    span_id: partial.span_id ?? "33333333-3333-4333-8333-333333333333",
    agent_id: partial.agent_id,
    organization_id: partial.organization_id ?? "44444444-4444-4444-8444-444444444444",
    tenant_id: partial.organization_id ?? "44444444-4444-4444-8444-444444444444",
    workspace_id: partial.workspace_id ?? "55555555-5555-4555-8555-555555555555",
    user_id: partial.user_id ?? null,
    conversation_id: partial.conversation_id ?? null,
  };
}

describe("MemoryGateway Phase 18", () => {
  it("Adam writes run.working; Nova recalls same run_id", async () => {
    const store = new InMemoryMemoryStore();
    const gateway = new MemoryGateway({
      store,
      personaEngine: new PersonaEngine(),
      summarizer: new DeterministicConversationSummarizer(),
    });

    const runId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const adamCtx = ctx({ agent_id: "adam", run_id: runId });
    const written = await gateway.remember(
      { scope: "run.working", content: "Brief: LinkedIn post about Verse", type: "ephemeral" },
      adamCtx,
    );
    assert.equal(written.layer, "L1");
    assert.equal(written.run_id, runId);
    assert.equal(written.trace_id, adamCtx.trace_id);
    assert.ok(written.id.length > 10);

    const novaCtx = ctx({ agent_id: "nova", run_id: runId, trace_id: adamCtx.trace_id });
    const recalled = await gateway.recall({ scope: "run.working", query: "LinkedIn", limit: 5 }, novaCtx);
    assert.equal(recalled.length, 1);
    assert.equal(recalled[0]?.content, "Brief: LinkedIn post about Verse");
  });

  it("isolates user.private between users in same org", async () => {
    const store = new InMemoryMemoryStore();
    const gateway = new MemoryGateway({
      store,
      personaEngine: new PersonaEngine(),
      summarizer: new DeterministicConversationSummarizer(),
    });

    const userA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const userB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    await gateway.remember(
      { scope: "user.private", content: "secret-of-A", type: "conversational" },
      ctx({ agent_id: "nova", user_id: userA }),
    );

    const forB = await gateway.recall(
      { scope: "user.private", query: "secret", limit: 10 },
      ctx({ agent_id: "nova", user_id: userB }),
    );
    assert.equal(forB.length, 0);

    const forA = await gateway.recall(
      { scope: "user.private", query: "secret", limit: 10 },
      ctx({ agent_id: "nova", user_id: userA }),
    );
    assert.equal(forA.length, 1);
  });

  it("isolates organizations on run.working", async () => {
    const store = new InMemoryMemoryStore();
    const gateway = new MemoryGateway({
      store,
      personaEngine: new PersonaEngine(),
      summarizer: new DeterministicConversationSummarizer(),
    });
    const runId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    await gateway.remember(
      { scope: "run.working", content: "org-A-brief", type: "ephemeral" },
      ctx({
        agent_id: "adam",
        run_id: runId,
        organization_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      }),
    );
    const other = await gateway.recall(
      { scope: "run.working", query: "brief", limit: 10 },
      ctx({
        agent_id: "nova",
        run_id: runId,
        organization_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      }),
    );
    assert.equal(other.length, 0);
  });

  it("summarize is deterministic and strategy-swappable", async () => {
    const store = new InMemoryMemoryStore();
    const gateway = new MemoryGateway({
      store,
      personaEngine: new PersonaEngine(),
      summarizer: new DeterministicConversationSummarizer(),
    });
    const conversationId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const base = ctx({
      agent_id: "adam",
      conversation_id: conversationId,
    });
    await gateway.remember(
      { scope: "conversation", content: "First note", type: "conversational" },
      base,
    );
    await gateway.remember(
      { scope: "conversation", content: "Second note", type: "conversational" },
      base,
    );
    const a = await gateway.summarize("conversation", base);
    const b = await gateway.summarize("conversation", base);
    assert.equal(a, b);
    assert.ok(a.includes("First note"));
    assert.ok(a.includes("Second note"));
    assert.equal(gateway.getSummarizer().strategy_id, "deterministic-concat-v1");
  });

  it("forbids write outside persona scopes", async () => {
    const gateway = new MemoryGateway({
      store: new InMemoryMemoryStore(),
      personaEngine: new PersonaEngine(),
      summarizer: new DeterministicConversationSummarizer(),
    });
    await assert.rejects(
      () =>
        gateway.remember(
          { scope: "org.brand", content: "x", type: "factual" },
          ctx({ agent_id: "adam" }),
        ),
      (err: unknown) => err instanceof KernelError && err.code === "FORBIDDEN",
    );
  });
});

describe("MemoryGateway Phase 25 L4", () => {
  it("semantic recall returns explainable deterministic scores", async () => {
    const store = new InMemoryMemoryStore();
    const vectorIndex = new InMemoryVectorIndex();
    const gateway = new MemoryGateway({
      store,
      vectorIndex,
      semanticEnabled: true,
      personaEngine: new PersonaEngine(),
      summarizer: new DeterministicConversationSummarizer(),
    });

    await gateway.adminRemember({
      organization_id: "44444444-4444-4444-8444-444444444444",
      workspace_id: "55555555-5555-4555-8555-555555555555",
      scope: "org.brand",
      content: "Tone of voice = premium, formal, never use emojis",
      pinned: true,
    });
    await gateway.adminRemember({
      organization_id: "44444444-4444-4444-8444-444444444444",
      workspace_id: "55555555-5555-4555-8555-555555555555",
      scope: "org.brand",
      content: "Primary color is deep teal",
    });

    const nova = ctx({ agent_id: "nova" });
    const a = await gateway.recall(
      { scope: "org.brand", query: "tone of voice premium formal", limit: 5 },
      nova,
    );
    const b = await gateway.recall(
      { scope: "org.brand", query: "tone of voice premium formal", limit: 5 },
      nova,
    );
    assert.ok(a.length >= 1);
    assert.equal(a[0]?.explanation?.strategy, "semantic");
    assert.equal(typeof a[0]?.explanation?.score, "number");
    assert.equal(typeof a[0]?.explanation?.distance, "number");
    assert.equal(a[0]?.explanation?.source, "vector_index");
    assert.deepEqual(
      a.map((r) => ({ id: r.id, score: r.explanation?.score, distance: r.explanation?.distance })),
      b.map((r) => ({ id: r.id, score: r.explanation?.score, distance: r.explanation?.distance })),
    );
    assert.ok(a[0]?.content.toLowerCase().includes("tone") || a[0]?.pinned);
  });

  it("kill-switch falls back to substring without breaking", async () => {
    const store = new InMemoryMemoryStore();
    const vectorIndex = new InMemoryVectorIndex();
    const gateway = new MemoryGateway({
      store,
      vectorIndex,
      semanticEnabled: false,
      personaEngine: new PersonaEngine(),
      summarizer: new DeterministicConversationSummarizer(),
    });
    await gateway.adminRemember({
      organization_id: "44444444-4444-4444-8444-444444444444",
      workspace_id: "55555555-5555-4555-8555-555555555555",
      scope: "org.brand",
      content: "Tone of voice = premium",
    });
    const hits = await gateway.recall(
      { scope: "org.brand", query: "premium", limit: 5 },
      ctx({ agent_id: "nova" }),
    );
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.explanation?.strategy, "semantic_disabled_fallback");
    assert.equal(hits[0]?.explanation?.source, "memory_store");
  });

  it("isolates vector hits across organizations", async () => {
    const store = new InMemoryMemoryStore();
    const vectorIndex = new InMemoryVectorIndex();
    const gateway = new MemoryGateway({
      store,
      vectorIndex,
      semanticEnabled: true,
      personaEngine: new PersonaEngine(),
      summarizer: new DeterministicConversationSummarizer(),
    });
    const orgA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const orgB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    await gateway.adminRemember({
      organization_id: orgA,
      workspace_id: "55555555-5555-4555-8555-555555555555",
      scope: "org.brand",
      content: "Secret brand A voice",
    });
    const hits = await gateway.recall(
      { scope: "org.brand", query: "Secret brand voice", limit: 5 },
      ctx({ agent_id: "nova", organization_id: orgB }),
    );
    assert.equal(hits.length, 0);
  });

  it("pin respects pin_brand_only; adam cannot pin", async () => {
    const store = new InMemoryMemoryStore();
    const gateway = new MemoryGateway({
      store,
      vectorIndex: new InMemoryVectorIndex(),
      personaEngine: new PersonaEngine(),
      summarizer: new DeterministicConversationSummarizer(),
    });
    const record = await gateway.adminRemember({
      organization_id: "44444444-4444-4444-8444-444444444444",
      workspace_id: "55555555-5555-4555-8555-555555555555",
      scope: "org.brand",
      content: "Brand fact",
      pinned: false,
    });
    await gateway.pin(record.id, ctx({ agent_id: "nova" }));
    const pinned = await store.getById(record.id, record.organization_id);
    assert.equal(pinned?.pinned, true);

    await assert.rejects(
      () => gateway.pin(record.id, ctx({ agent_id: "adam" })),
      (err: unknown) => err instanceof KernelError && err.code === "FORBIDDEN",
    );
  });

  it("forget soft-deletes and removes vector row", async () => {
    const store = new InMemoryMemoryStore();
    const vectorIndex = new InMemoryVectorIndex();
    const gateway = new MemoryGateway({
      store,
      vectorIndex,
      semanticEnabled: true,
      personaEngine: new PersonaEngine(),
      summarizer: new DeterministicConversationSummarizer(),
    });
    const record = await gateway.adminRemember({
      organization_id: "44444444-4444-4444-8444-444444444444",
      workspace_id: "55555555-5555-4555-8555-555555555555",
      scope: "org.content",
      content: "Draft campaign copy",
    });
    assert.equal(vectorIndex.size(), 1);
    await gateway.forget(record.id, ctx({ agent_id: "nova" }));
    assert.equal(vectorIndex.size(), 0);
    const gone = await gateway.recall(
      { scope: "org.content", query: "campaign", limit: 5 },
      ctx({ agent_id: "nova" }),
    );
    assert.equal(gone.length, 0);
  });
});
