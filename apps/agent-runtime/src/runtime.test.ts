import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createBus, agentEventsTopic, agentTasksTopic, type InMemoryBus } from "@at72-verse/bus";
import {
  FIRST_PARTY_CAPABILITY_DEFAULTS,
  type AgentTaskPayload,
  type BusMessage,
} from "@at72-verse/contracts";
import {
  buildBudgetSnapshot,
  buildCapabilityGrantSnapshot,
  buildPackagesSnapshotFromSeeds,
  createNoopAdapters,
  createVerseCore,
  InMemoryToolExecutionAudit,
  ManagedLlmAdapter,
  type LlmProviderAdapter,
  type ProviderCompleteInput,
} from "@at72-verse/verse-core";
import { createDefaultAgentRegistry, startAgentRuntime } from "./runtime.js";

function testGrantsSnapshot(
  overrides: Array<{
    kind: "agent" | "skill" | "tool";
    capability_id: string;
    enabled: boolean;
  }> = [],
) {
  const byKey = new Map(
    FIRST_PARTY_CAPABILITY_DEFAULTS.map((g) => [`${g.kind}:${g.capability_id}`, { ...g }]),
  );
  for (const o of overrides) {
    byKey.set(`${o.kind}:${o.capability_id}`, o);
  }
  return buildCapabilityGrantSnapshot({
    organization_id: "org-1",
    workspace_id: "ws-1",
    grants: [...byKey.values()],
    captured_at: "2026-07-19T12:00:00.000Z",
  });
}

function testBudgetSnapshot(runId: string) {
  return buildBudgetSnapshot({
    organization_id: "org-1",
    workspace_id: "ws-1",
    run_id: runId,
    max_usd: 1,
    max_tokens: 100_000,
    captured_at: "2026-07-19T12:00:00.000Z",
  });
}

function testPackagesSnapshot(excludePackageIds: string[] = []) {
  return buildPackagesSnapshotFromSeeds("org-1", {
    excludePackageIds,
    captured_at: "2026-07-19T12:00:00.000Z",
  });
}

function sampleTask(runId: string, traceId: string, goal?: string): BusMessage {
  const payload: AgentTaskPayload = {
    run_id: runId,
    step_id: "step-1",
    trace_id: traceId,
    goal,
    grants_snapshot: testGrantsSnapshot(),
    budget_snapshot: testBudgetSnapshot(runId),
    packages_snapshot: testPackagesSnapshot(),
  };
  return {
    event_id: crypto.randomUUID(),
    correlation_id: traceId,
    causation_id: crypto.randomUUID(),
    tenant_id: "org-1",
    workspace_id: "ws-1",
    run_id: runId,
    timestamp: new Date().toISOString(),
    version: "1",
    event_type: "agent.task",
    payload: { ...payload },
  };
}

class FakeProvider implements LlmProviderAdapter {
  readonly id = "openai";
  async complete(input: ProviderCompleteInput) {
    const system = input.messages.find((m) => m.role === "system")?.content ?? "";
    const user = input.messages.find((m) => m.role === "user")?.content ?? "";
    if (system.includes("Adam") || system.includes("orchestrator")) {
      if (/campagne|campaign/i.test(user)) {
        return {
          content: JSON.stringify({
            mode: "campaign",
            targets: ["nova", "astra", "pixel"],
            brief: user,
            summary: "Fan-out campaign Nova + Astra + Pixel",
          }),
          input_tokens: 4,
          output_tokens: 16,
        };
      }
      return {
        content: JSON.stringify({
          mode: "single",
          delegate_to: "nova",
          brief: "Write a short LinkedIn post about Verse",
          summary: "Delegate to Nova",
        }),
        input_tokens: 4,
        output_tokens: 12,
      };
    }
    const joined = input.messages.map((m) => m.content).join(" | ");
    // Echo formality when present (Phase 17 integration proof)
    const formalityMatch = joined.match(/Formality(?:\s*\([^)]*\))?:\s*(\w+)/i);
    const formalityTag = formalityMatch ? ` [formality=${formalityMatch[1]}]` : "";
    // Prefer echoing an explicit writing brief when present (Phase 18 memory proof)
    const briefMatch = joined.match(/Brief:\s*([^\n|]+)/i);
    const body = briefMatch
      ? briefMatch[1]!.trim()
      : joined.slice(0, 80);
    return {
      content: `# Draft\n\nBody for: ${body}${formalityTag}`,
      input_tokens: 4,
      output_tokens: 12,
    };
  }
}

describe("agent-runtime Phase 12/14/15", () => {
  it("executes Adam and publishes task.completed with plan + run_id + trace_id", async () => {
    const bus = createBus({ backend: "memory" }) as InMemoryBus;
    const runtime = await startAgentRuntime({ bus, consumerGroup: "test-runtime-adam" });
    const runId = "11111111-1111-4111-8111-111111111111";
    const traceId = "55555555-5555-4555-8555-555555555555";

    await bus.publish(sampleTask(runId, traceId, "phase12-demo"), {
      topic: agentTasksTopic("adam"),
    });

    const events = bus.getPublished(agentEventsTopic("adam"));
    assert.ok(events.length >= 1);
    const last = events[events.length - 1]!;
    assert.equal(last.run_id, runId);
    assert.equal(last.event_type, "task.completed");
    assert.equal(last.payload.trace_id, traceId);
    assert.equal(last.payload.run_id, runId);
    assert.equal(last.payload.status, "completed");
    const plan = last.payload.plan as { steps: Array<{ name: string }> };
    assert.ok(plan.steps.some((s) => s.name === "analyze_goal"));
    assert.ok(plan.steps.some((s) => s.name === "aggregate_result"));
    assert.ok(!plan.steps.some((s) => s.name === "delegate_nova"));

    await runtime.stop();
  });

  it("Adam → Nova in-process delegation publishes nova task.delegated + completed", async () => {
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
      consumerGroup: "test-runtime-orch",
    });

    const runId = "11111111-1111-4111-8111-111111111113";
    const traceId = "55555555-5555-4555-8555-555555555557";

    await bus.publish(sampleTask(runId, traceId, "Rédige un post LinkedIn sur Verse"), {
      topic: agentTasksTopic("adam"),
    });

    const novaEvents = bus.getPublished(agentEventsTopic("nova"));
    assert.ok(novaEvents.some((e) => e.event_type === "task.delegated"));
    const novaCompleted = novaEvents.filter((e) => e.event_type === "task.completed");
    assert.equal(novaCompleted.length, 1);
    assert.equal(novaCompleted[0]!.payload.status, "completed");

    const adamEvents = bus.getPublished(agentEventsTopic("adam"));
    const adamCompleted = adamEvents[adamEvents.length - 1]!;
    assert.equal(adamCompleted.event_type, "task.completed");
    assert.equal(adamCompleted.payload.status, "completed");
    const adamResult = adamCompleted.payload.result as { content?: string } | undefined;
    assert.equal(typeof adamResult?.content, "string");

    await runtime.stop();
  });

  it("Nova failure → Adam task.completed failed (cascade)", async () => {
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
    const base = createDefaultAgentRegistry();
    const registry = new Map(base);
    registry.set("nova", {
      id: "nova",
      tools_allowlist: ["web-search", "file-read-write"],
      handleTask: async () => {
        throw new Error("Nova simulated failure");
      },
    });
    const runtime = await startAgentRuntime({
      bus,
      core,
      registry,
      consumerGroup: "test-runtime-orch-fail",
    });

    const runId = "11111111-1111-4111-8111-111111111114";
    const traceId = "55555555-5555-4555-8555-555555555558";

    await bus.publish(sampleTask(runId, traceId, "Rédige un post LinkedIn (fail)"), {
      topic: agentTasksTopic("adam"),
    });

    const novaEvents = bus.getPublished(agentEventsTopic("nova"));
    assert.ok(novaEvents.some((e) => e.event_type === "task.delegated"));
    const novaFailed = novaEvents.find((e) => e.event_type === "task.completed");
    assert.equal(novaFailed?.payload.status, "failed");

    const adamEvents = bus.getPublished(agentEventsTopic("adam"));
    const adamCompleted = adamEvents[adamEvents.length - 1]!;
    assert.equal(adamCompleted.payload.status, "failed");
    assert.match(String(adamCompleted.payload.error), /Nova simulated failure/);

    await runtime.stop();
  });

  it("executes Nova → skill.writing via Kernel (fake LLM) and returns result", async () => {
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
      consumerGroup: "test-runtime-nova",
    });

    assert.ok(runtime.skills.includes("skill.writing"));
    assert.ok(runtime.agents.includes("nova"));

    const runId = "11111111-1111-4111-8111-111111111112";
    const traceId = "55555555-5555-4555-8555-555555555556";

    await bus.publish(sampleTask(runId, traceId, "Announce Nova writing skill"), {
      topic: agentTasksTopic("nova"),
    });

    const events = bus.getPublished(agentEventsTopic("nova"));
    assert.ok(events.length >= 1);
    const last = events[events.length - 1]!;
    assert.equal(last.event_type, "task.completed");
    assert.equal(last.payload.status, "completed");
    const result = last.payload.result as { content?: string } | undefined;
    assert.equal(typeof result?.content, "string");
    assert.ok(String(result?.content).length > 0);

    await runtime.stop();
  });

  it("workspace formality=vouvoiement reaches Nova writing content (Phase 17)", async () => {
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
      consumerGroup: "test-runtime-persona",
    });

    const runId = "11111111-1111-4111-8111-111111111115";
    const traceId = "55555555-5555-4555-8555-555555555559";
    const payload: AgentTaskPayload = {
      run_id: runId,
      step_id: "step-persona",
      trace_id: traceId,
      goal: "Announce Verse with formal address",
      persona_workspace_override: { tone: { formality: "vouvoiement" } },
      grants_snapshot: testGrantsSnapshot(),
      budget_snapshot: testBudgetSnapshot(runId),
      packages_snapshot: testPackagesSnapshot(),
    };
    await bus.publish(
      {
        event_id: crypto.randomUUID(),
        correlation_id: traceId,
        causation_id: crypto.randomUUID(),
        tenant_id: "org-1",
        workspace_id: "ws-1",
        run_id: runId,
        timestamp: new Date().toISOString(),
        version: "1",
        event_type: "agent.task",
        payload: { ...payload },
      },
      { topic: agentTasksTopic("nova") },
    );

    const events = bus.getPublished(agentEventsTopic("nova"));
    const last = events[events.length - 1]!;
    assert.equal(last.payload.status, "completed");
    const result = last.payload.result as { content?: string } | undefined;
    assert.match(String(result?.content), /vouvoiement/i);
    const resolved = last.payload.resolved_persona as
      | { spec?: { tone?: { formality?: string } } }
      | undefined;
    assert.equal(resolved?.spec?.tone?.formality, "vouvoiement");

    await runtime.stop();
  });

  it("Adam → Nova uses run.working memory brief (not task payload)", async () => {
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
      consumerGroup: "test-runtime-memory-brief",
    });

    const runId = "11111111-1111-4111-8111-111111111120";
    const traceId = "55555555-5555-4555-8555-555555555570";

    await bus.publish(sampleTask(runId, traceId, "Rédige un post LinkedIn sur Verse"), {
      topic: agentTasksTopic("adam"),
    });

    const adamEvents = bus.getPublished(agentEventsTopic("adam"));
    const adamCompleted = adamEvents[adamEvents.length - 1]!;
    assert.equal(adamCompleted.payload.status, "completed");
    const adamResult = adamCompleted.payload.result as { content?: string } | undefined;
    assert.equal(typeof adamResult?.content, "string");
    assert.match(String(adamResult?.content), /Write a short LinkedIn post about Verse/);
    assert.doesNotMatch(String(adamResult?.content), /brief in run\.working/);

    const recalled = await core.getMemoryGateway().recall(
      { scope: "run.working", query: "", limit: 5 },
      {
        run_id: runId,
        trace_id: traceId,
        span_id: "33333333-3333-4333-8333-333333333333",
        agent_id: "nova",
        organization_id: "org-1",
        tenant_id: "org-1",
        workspace_id: "ws-1",
        user_id: null,
      },
    );
    assert.equal(recalled.length, 1);
    assert.equal(recalled[0]!.content, "Write a short LinkedIn post about Verse");

    await runtime.stop();
  });

  it("Nova + skill.writing with use_web_search cites stub source (Phase 19)", async () => {
    const bus = createBus({ backend: "memory" }) as InMemoryBus;
    const llm = new ManagedLlmAdapter({
      bus,
      provider: new FakeProvider(),
      credentials: { platformApiKey: "test-key" },
    });
    const audit = new InMemoryToolExecutionAudit();
    const core = createVerseCore({
      bus,
      adapters: { ...createNoopAdapters(), llm },
      kernelBackend: "core",
      toolAudit: audit,
    });
    const runtime = await startAgentRuntime({
      bus,
      core,
      consumerGroup: "test-runtime-tools-search",
    });

    const runId = "11111111-1111-4111-8111-111111111130";
    const traceId = "55555555-5555-4555-8555-555555555580";
    const payload: AgentTaskPayload = {
      run_id: runId,
      step_id: "step-tools",
      trace_id: traceId,
      goal: "Announce Verse platform",
      use_web_search: true,
      search_query: "AT72 Verse",
      grants_snapshot: testGrantsSnapshot(),
      budget_snapshot: testBudgetSnapshot(runId),
      packages_snapshot: testPackagesSnapshot(),
    } as AgentTaskPayload & { use_web_search: boolean; search_query: string };

    await bus.publish(
      {
        event_id: crypto.randomUUID(),
        correlation_id: traceId,
        causation_id: crypto.randomUUID(),
        tenant_id: "org-1",
        workspace_id: "ws-1",
        run_id: runId,
        timestamp: new Date().toISOString(),
        version: "1",
        event_type: "agent.task",
        payload: { ...payload },
      },
      { topic: agentTasksTopic("nova") },
    );

    const events = bus.getPublished(agentEventsTopic("nova"));
    const last = events[events.length - 1]!;
    assert.equal(last.payload.status, "completed");
    const result = last.payload.result as { sources?: Array<{ url?: string }> } | undefined;
    assert.ok(Array.isArray(result?.sources) && result!.sources!.length > 0);
    assert.match(String(result!.sources![0]!.url), /example\.com/);
    assert.ok(audit.entries.some((e) => e.tool_id === "web-search" && e.status === "completed"));

    await runtime.stop();
  });

  it("forbidden tool is audited when allowlist empty (Phase 19)", async () => {
    const bus = createBus({ backend: "memory" }) as InMemoryBus;
    const audit = new InMemoryToolExecutionAudit();
    const core = createVerseCore({
      bus,
      kernelBackend: "core",
      toolAudit: audit,
    });
    const base = createDefaultAgentRegistry();
    const registry = new Map(base);
    registry.set("nova", {
      id: "nova",
      tools_allowlist: [],
      handleTask: async ({ kernel }) => {
        await kernel.tools.execute({ tool_id: "web-search", input: { query: "x" } });
        return { plan: { version: "1", steps: [] } };
      },
    });
    const runtime = await startAgentRuntime({
      bus,
      core,
      registry,
      consumerGroup: "test-runtime-tools-forbid",
    });

    const runId = "11111111-1111-4111-8111-111111111131";
    const traceId = "55555555-5555-4555-8555-555555555581";
    await bus.publish(sampleTask(runId, traceId, "ping"), {
      topic: agentTasksTopic("nova"),
    });

    const events = bus.getPublished(agentEventsTopic("nova"));
    const last = events[events.length - 1]!;
    assert.equal(last.payload.status, "failed");
    assert.ok(audit.entries.some((e) => e.status === "forbidden"));

    await runtime.stop();
  });

  it("disabled agent is refused before handleTask (Phase 20 / DN7)", async () => {
    const bus = createBus({ backend: "memory" }) as InMemoryBus;
    let handled = false;
    const base = createDefaultAgentRegistry();
    const registry = new Map(base);
    registry.set("adam", {
      id: "adam",
      tools_allowlist: [],
      handleTask: async () => {
        handled = true;
        return { plan: { version: "1", steps: [] } };
      },
    });
    const runtime = await startAgentRuntime({
      bus,
      registry,
      consumerGroup: "test-runtime-agent-disabled",
    });

    const runId = "11111111-1111-4111-8111-111111111140";
    const traceId = "55555555-5555-4555-8555-555555555590";
    const payload: AgentTaskPayload = {
      run_id: runId,
      step_id: "step-deny",
      trace_id: traceId,
      goal: "should not run",
      grants_snapshot: testGrantsSnapshot([
        { kind: "agent", capability_id: "adam", enabled: false },
      ]),
      budget_snapshot: testBudgetSnapshot(runId),
      packages_snapshot: testPackagesSnapshot(),
    };
    await bus.publish(
      {
        event_id: crypto.randomUUID(),
        correlation_id: traceId,
        causation_id: crypto.randomUUID(),
        tenant_id: "org-1",
        workspace_id: "ws-1",
        run_id: runId,
        timestamp: new Date().toISOString(),
        version: "1",
        event_type: "agent.task",
        payload: { ...payload },
      },
      { topic: agentTasksTopic("adam") },
    );

    const events = bus.getPublished(agentEventsTopic("adam"));
    const last = events[events.length - 1]!;
    assert.equal(last.payload.status, "failed");
    assert.match(String(last.payload.error), /agent_disabled/);
    assert.equal(handled, false);
    await runtime.stop();
  });

  it("uninstalled Nova is refused before handleTask (Phase 22 / DP9)", async () => {
    const bus = createBus({ backend: "memory" }) as InMemoryBus;
    let handled = false;
    const base = createDefaultAgentRegistry();
    const registry = new Map(base);
    registry.set("nova", {
      id: "nova",
      tools_allowlist: [],
      handleTask: async () => {
        handled = true;
        return { plan: { version: "1", steps: [] } };
      },
    });
    const runtime = await startAgentRuntime({
      bus,
      registry,
      consumerGroup: "test-runtime-pkg-uninstalled",
    });

    const runId = "11111111-1111-4111-8111-111111111141";
    const traceId = "55555555-5555-4555-8555-555555555591";
    const payload: AgentTaskPayload = {
      run_id: runId,
      step_id: "step-pkg",
      trace_id: traceId,
      goal: "should not run",
      grants_snapshot: testGrantsSnapshot(),
      budget_snapshot: testBudgetSnapshot(runId),
      packages_snapshot: testPackagesSnapshot(["pkg.nova"]),
    };
    await bus.publish(
      {
        event_id: crypto.randomUUID(),
        correlation_id: traceId,
        causation_id: crypto.randomUUID(),
        tenant_id: "org-1",
        workspace_id: "ws-1",
        run_id: runId,
        timestamp: new Date().toISOString(),
        version: "1",
        event_type: "agent.task",
        payload: { ...payload },
      },
      { topic: agentTasksTopic("nova") },
    );

    const events = bus.getPublished(agentEventsTopic("nova"));
    const last = events[events.length - 1]!;
    assert.equal(last.payload.status, "failed");
    assert.match(String(last.payload.error), /not installed/i);
    assert.equal(handled, false);
    await runtime.stop();
  });

  it("Adam → Nova fails cleanly when Nova package uninstalled (Phase 22 / DP9)", async () => {
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
      consumerGroup: "test-runtime-pkg-delegate-uninstall",
    });

    const runId = "11111111-1111-4111-8111-111111111142";
    const traceId = "55555555-5555-4555-8555-555555555592";
    const payload: AgentTaskPayload = {
      run_id: runId,
      step_id: "step-adam",
      trace_id: traceId,
      goal: "Rédige un post LinkedIn sur Verse",
      grants_snapshot: testGrantsSnapshot(),
      budget_snapshot: testBudgetSnapshot(runId),
      packages_snapshot: testPackagesSnapshot(["pkg.nova"]),
    };
    await bus.publish(
      {
        event_id: crypto.randomUUID(),
        correlation_id: traceId,
        causation_id: crypto.randomUUID(),
        tenant_id: "org-1",
        workspace_id: "ws-1",
        run_id: runId,
        timestamp: new Date().toISOString(),
        version: "1",
        event_type: "agent.task",
        payload: { ...payload },
      },
      { topic: agentTasksTopic("adam") },
    );

    const events = bus.getPublished(agentEventsTopic("adam"));
    const last = events[events.length - 1]!;
    assert.equal(last.payload.status, "failed");
    assert.match(String(last.payload.error), /not installed/i);
    await runtime.stop();
  });

  it("Orion completes analysis golden path (Phase 23)", async () => {
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
      consumerGroup: "test-runtime-orion",
    });

    const runId = "11111111-1111-4111-8111-111111111150";
    const traceId = "55555555-5555-4555-8555-555555555600";
    await bus.publish(
      {
        event_id: crypto.randomUUID(),
        correlation_id: traceId,
        causation_id: crypto.randomUUID(),
        tenant_id: "org-1",
        workspace_id: "ws-1",
        run_id: runId,
        timestamp: new Date().toISOString(),
        version: "1",
        event_type: "agent.task",
        payload: {
          run_id: runId,
          step_id: "step-orion",
          trace_id: traceId,
          goal: "Analyse the Verse competitive landscape",
          grants_snapshot: testGrantsSnapshot(),
          budget_snapshot: testBudgetSnapshot(runId),
          packages_snapshot: testPackagesSnapshot(),
        },
      },
      { topic: agentTasksTopic("orion") },
    );

    const events = bus.getPublished(agentEventsTopic("orion"));
    const last = events[events.length - 1]!;
    assert.equal(last.payload.status, "completed");
    const result = last.payload.result as { content?: string; insights?: string[] } | undefined;
    assert.equal(typeof result?.content, "string");
    assert.ok(Array.isArray(result?.insights));
    await runtime.stop();
  });

  it("Astra completes SEO golden path (Phase 23)", async () => {
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
      consumerGroup: "test-runtime-astra",
    });

    const runId = "11111111-1111-4111-8111-111111111151";
    const traceId = "55555555-5555-4555-8555-555555555601";
    await bus.publish(
      {
        event_id: crypto.randomUUID(),
        correlation_id: traceId,
        causation_id: crypto.randomUUID(),
        tenant_id: "org-1",
        workspace_id: "ws-1",
        run_id: runId,
        timestamp: new Date().toISOString(),
        version: "1",
        event_type: "agent.task",
        payload: {
          run_id: runId,
          step_id: "step-astra",
          trace_id: traceId,
          goal: "SEO audit homepage",
          url: "https://example.com/verse",
          grants_snapshot: testGrantsSnapshot(),
          budget_snapshot: testBudgetSnapshot(runId),
          packages_snapshot: testPackagesSnapshot(),
        },
      },
      { topic: agentTasksTopic("astra") },
    );

    const events = bus.getPublished(agentEventsTopic("astra"));
    const last = events[events.length - 1]!;
    assert.equal(last.payload.status, "completed");
    const result = last.payload.result as
      | { content?: string; score?: number; recommendations?: string[] }
      | undefined;
    assert.equal(typeof result?.content, "string");
    assert.equal(typeof result?.score, "number");
    assert.ok(Array.isArray(result?.recommendations));
    await runtime.stop();
  });

  it("Pixel completes image brief golden path (Phase 23)", async () => {
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
      consumerGroup: "test-runtime-pixel",
    });

    const runId = "11111111-1111-4111-8111-111111111152";
    const traceId = "55555555-5555-4555-8555-555555555602";
    await bus.publish(
      {
        event_id: crypto.randomUUID(),
        correlation_id: traceId,
        causation_id: crypto.randomUUID(),
        tenant_id: "org-1",
        workspace_id: "ws-1",
        run_id: runId,
        timestamp: new Date().toISOString(),
        version: "1",
        event_type: "agent.task",
        payload: {
          run_id: runId,
          step_id: "step-pixel",
          trace_id: traceId,
          goal: "Design a hero image for Verse",
          grants_snapshot: testGrantsSnapshot(),
          budget_snapshot: testBudgetSnapshot(runId),
          packages_snapshot: testPackagesSnapshot(),
        },
      },
      { topic: agentTasksTopic("pixel") },
    );

    const events = bus.getPublished(agentEventsTopic("pixel"));
    const last = events[events.length - 1]!;
    assert.equal(last.payload.status, "completed");
    const result = last.payload.result as { content?: string; prompt?: string } | undefined;
    assert.equal(typeof result?.content, "string");
    assert.equal(typeof result?.prompt, "string");
    await runtime.stop();
  });

  it("disabled Orion grant is refused before handleTask (Phase 23 / DQ10)", async () => {
    const bus = createBus({ backend: "memory" }) as InMemoryBus;
    let handled = false;
    const base = createDefaultAgentRegistry();
    const registry = new Map(base);
    registry.set("orion", {
      id: "orion",
      tools_allowlist: ["web-search"],
      handleTask: async () => {
        handled = true;
        return { plan: { version: "1", steps: [] } };
      },
    });
    const runtime = await startAgentRuntime({
      bus,
      registry,
      consumerGroup: "test-runtime-orion-grant",
    });

    const runId = "11111111-1111-4111-8111-111111111153";
    const traceId = "55555555-5555-4555-8555-555555555603";
    await bus.publish(
      {
        event_id: crypto.randomUUID(),
        correlation_id: traceId,
        causation_id: crypto.randomUUID(),
        tenant_id: "org-1",
        workspace_id: "ws-1",
        run_id: runId,
        timestamp: new Date().toISOString(),
        version: "1",
        event_type: "agent.task",
        payload: {
          run_id: runId,
          step_id: "step-deny",
          trace_id: traceId,
          goal: "should not run",
          grants_snapshot: testGrantsSnapshot([
            { kind: "agent", capability_id: "orion", enabled: false },
          ]),
          budget_snapshot: testBudgetSnapshot(runId),
          packages_snapshot: testPackagesSnapshot(),
        },
      },
      { topic: agentTasksTopic("orion") },
    );

    const events = bus.getPublished(agentEventsTopic("orion"));
    const last = events[events.length - 1]!;
    assert.equal(last.payload.status, "failed");
    assert.match(String(last.payload.error), /agent_disabled/);
    assert.equal(handled, false);
    await runtime.stop();
  });

  it("uninstalled Orion package is refused before handleTask (Phase 23 / DQ10)", async () => {
    const bus = createBus({ backend: "memory" }) as InMemoryBus;
    let handled = false;
    const base = createDefaultAgentRegistry();
    const registry = new Map(base);
    registry.set("orion", {
      id: "orion",
      tools_allowlist: ["web-search"],
      handleTask: async () => {
        handled = true;
        return { plan: { version: "1", steps: [] } };
      },
    });
    const runtime = await startAgentRuntime({
      bus,
      registry,
      consumerGroup: "test-runtime-orion-pkg",
    });

    const runId = "11111111-1111-4111-8111-111111111154";
    const traceId = "55555555-5555-4555-8555-555555555604";
    await bus.publish(
      {
        event_id: crypto.randomUUID(),
        correlation_id: traceId,
        causation_id: crypto.randomUUID(),
        tenant_id: "org-1",
        workspace_id: "ws-1",
        run_id: runId,
        timestamp: new Date().toISOString(),
        version: "1",
        event_type: "agent.task",
        payload: {
          run_id: runId,
          step_id: "step-pkg",
          trace_id: traceId,
          goal: "should not run",
          grants_snapshot: testGrantsSnapshot(),
          budget_snapshot: testBudgetSnapshot(runId),
          packages_snapshot: testPackagesSnapshot(["pkg.orion"]),
        },
      },
      { topic: agentTasksTopic("orion") },
    );

    const events = bus.getPublished(agentEventsTopic("orion"));
    const last = events[events.length - 1]!;
    assert.equal(last.payload.status, "failed");
    assert.match(String(last.payload.error), /not installed/i);
    assert.equal(handled, false);
    await runtime.stop();
  });

  it("Adam campaign fan-out Nova+Astra+Pixel with deterministic aggregate (Phase 24 / DR4)", async () => {
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
      consumerGroup: "test-runtime-campaign",
    });

    const runId = "11111111-1111-4111-8111-111111111170";
    const traceId = "55555555-5555-4555-8555-555555555670";
    await bus.publish(
      sampleTask(runId, traceId, "Campagne article + SEO + visuel pour le lancement Verse"),
      { topic: agentTasksTopic("adam") },
    );

    const adamEvents = bus.getPublished(agentEventsTopic("adam"));
    const adamCompleted = adamEvents.find((e) => e.event_type === "task.completed");
    assert.ok(adamCompleted);
    assert.equal(adamCompleted.payload.status, "completed");

    const result = adamCompleted.payload.result as Record<string, unknown>;
    assert.deepEqual(Object.keys(result), ["nova", "astra", "pixel"]);

    for (const agentId of ["nova", "astra", "pixel"] as const) {
      const events = bus.getPublished(agentEventsTopic(agentId));
      assert.ok(events.some((e) => e.event_type === "task.delegated"), `${agentId} delegated`);
      assert.ok(
        events.some((e) => e.event_type === "task.completed" && e.payload.status === "completed"),
        `${agentId} completed`,
      );
    }

    const parentIds = ["nova", "astra", "pixel"].map((id) => {
      const del = bus
        .getPublished(agentEventsTopic(id))
        .find((e) => e.event_type === "task.delegated")!;
      return del.payload.parent_step_id as string | null;
    });
    assert.ok(parentIds.every((p) => p === parentIds[0]), "parallel siblings share parent_step_id");

    await runtime.stop();
  });

  it("Adam campaign fails all-or-nothing when one specialist fails (Phase 24 / DR5)", async () => {
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
    const base = createDefaultAgentRegistry();
    const registry = new Map(base);
    const pixel = base.get("pixel")!;
    registry.set("pixel", {
      ...pixel,
      handleTask: async () => {
        throw new Error("pixel boom");
      },
    });
    const runtime = await startAgentRuntime({
      bus,
      core,
      registry,
      consumerGroup: "test-runtime-campaign-fail",
    });

    const runId = "11111111-1111-4111-8111-111111111171";
    const traceId = "55555555-5555-4555-8555-555555555671";
    await bus.publish(sampleTask(runId, traceId, "Campagne article + SEO + image"), {
      topic: agentTasksTopic("adam"),
    });

    const adamCompleted = bus
      .getPublished(agentEventsTopic("adam"))
      .find((e) => e.event_type === "task.completed");
    assert.ok(adamCompleted);
    assert.equal(adamCompleted.payload.status, "failed");
    assert.match(String(adamCompleted.payload.error), /pixel boom|failed/i);
    await runtime.stop();
  });

  it("Nova ask Astra publishes task.consulted and keeps depth (Phase 24 / DR6)", async () => {
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
      consumerGroup: "test-runtime-ask",
    });

    const runId = "11111111-1111-4111-8111-111111111172";
    const traceId = "55555555-5555-4555-8555-555555555672";
    const payload = {
      run_id: runId,
      step_id: "step-nova-1",
      trace_id: traceId,
      goal: "Draft then consult SEO",
      delegation_depth: 1,
      grants_snapshot: testGrantsSnapshot(),
      budget_snapshot: testBudgetSnapshot(runId),
      packages_snapshot: testPackagesSnapshot(),
      consult_seo: true,
    } as AgentTaskPayload & { consult_seo: boolean };

    await bus.publish(
      {
        event_id: crypto.randomUUID(),
        correlation_id: traceId,
        causation_id: crypto.randomUUID(),
        tenant_id: "org-1",
        workspace_id: "ws-1",
        run_id: runId,
        timestamp: new Date().toISOString(),
        version: "1",
        event_type: "agent.task",
        payload,
      },
      { topic: agentTasksTopic("nova") },
    );

    const astraEvents = bus.getPublished(agentEventsTopic("astra"));
    assert.ok(astraEvents.some((e) => e.event_type === "task.consulted"));
    const consulted = astraEvents.find((e) => e.event_type === "task.consulted")!;
    assert.equal(consulted.payload.consulted_by, "nova");
    assert.equal(consulted.payload.agent_id, "astra");

    const astraCompleted = astraEvents.find((e) => e.event_type === "task.completed");
    assert.ok(astraCompleted);
    assert.equal(astraCompleted.payload.status, "completed");

    const novaCompleted = bus
      .getPublished(agentEventsTopic("nova"))
      .find((e) => e.event_type === "task.completed");
    assert.ok(novaCompleted);
    assert.equal(novaCompleted.payload.status, "completed");
    assert.ok((novaCompleted.payload.result as { seo_consult?: unknown })?.seo_consult);

    await runtime.stop();
  });

  it("ask refused when can_consult missing (Phase 24 / DR6)", async () => {
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
    const base = createDefaultAgentRegistry();
    const registry = new Map(base);
    const nova = base.get("nova")!;
    registry.set("nova", {
      ...nova,
      can_consult: [],
    });
    const runtime = await startAgentRuntime({
      bus,
      core,
      registry,
      consumerGroup: "test-runtime-ask-deny",
    });

    const runId = "11111111-1111-4111-8111-111111111173";
    const traceId = "55555555-5555-4555-8555-555555555673";
    const payload = {
      run_id: runId,
      step_id: "step-nova-deny",
      trace_id: traceId,
      goal: "Draft then consult SEO",
      grants_snapshot: testGrantsSnapshot(),
      budget_snapshot: testBudgetSnapshot(runId),
      packages_snapshot: testPackagesSnapshot(),
      consult_seo: true,
    } as AgentTaskPayload & { consult_seo: boolean };

    await bus.publish(
      {
        event_id: crypto.randomUUID(),
        correlation_id: traceId,
        causation_id: crypto.randomUUID(),
        tenant_id: "org-1",
        workspace_id: "ws-1",
        run_id: runId,
        timestamp: new Date().toISOString(),
        version: "1",
        event_type: "agent.task",
        payload,
      },
      { topic: agentTasksTopic("nova") },
    );

    const novaCompleted = bus
      .getPublished(agentEventsTopic("nova"))
      .find((e) => e.event_type === "task.completed");
    assert.ok(novaCompleted);
    assert.equal(novaCompleted.payload.status, "failed");
    assert.match(String(novaCompleted.payload.error), /Consult not allowed|can_consult/i);
    assert.equal(
      bus.getPublished(agentEventsTopic("astra")).some((e) => e.event_type === "task.consulted"),
      false,
    );
    await runtime.stop();
  });

  it("consulted agent cannot nest orchestration (Phase 24 ask lock)", async () => {
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
    const base = createDefaultAgentRegistry();
    const registry = new Map(base);
    const astra = base.get("astra")!;
    registry.set("astra", {
      ...astra,
      handleTask: async ({ kernel }) => {
        await kernel.orchestration.delegate({
          target_agent: "nova",
          task: { goal: "should never run" },
        });
        return { plan: { version: "1", steps: [] }, result: {} };
      },
    });
    const runtime = await startAgentRuntime({
      bus,
      core,
      registry,
      consumerGroup: "test-runtime-ask-lock",
    });

    const runId = "11111111-1111-4111-8111-111111111174";
    const traceId = "55555555-5555-4555-8555-555555555674";
    const payload = {
      run_id: runId,
      step_id: "step-nova-lock",
      trace_id: traceId,
      goal: "consult",
      grants_snapshot: testGrantsSnapshot(),
      budget_snapshot: testBudgetSnapshot(runId),
      packages_snapshot: testPackagesSnapshot(),
      consult_seo: true,
    } as AgentTaskPayload & { consult_seo: boolean };

    await bus.publish(
      {
        event_id: crypto.randomUUID(),
        correlation_id: traceId,
        causation_id: crypto.randomUUID(),
        tenant_id: "org-1",
        workspace_id: "ws-1",
        run_id: runId,
        timestamp: new Date().toISOString(),
        version: "1",
        event_type: "agent.task",
        payload,
      },
      { topic: agentTasksTopic("nova") },
    );

    const novaCompleted = bus
      .getPublished(agentEventsTopic("nova"))
      .find((e) => e.event_type === "task.completed");
    assert.ok(novaCompleted);
    assert.equal(novaCompleted.payload.status, "failed");
    assert.match(String(novaCompleted.payload.error), /orchestration_locked|forbidden/i);
    await runtime.stop();
  });

  it("Nova recalls org.brand tone of voice (Phase 25 / DS9)", async () => {
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
    await core.getMemoryGateway().adminRemember({
      organization_id: "org-1",
      workspace_id: "ws-1",
      scope: "org.brand",
      content: "Tone of voice = premium, formal, never use emojis",
      pinned: true,
    });

    const runtime = await startAgentRuntime({
      bus,
      core,
      consumerGroup: "test-runtime-brand",
    });

    const runId = "11111111-1111-4111-8111-111111111180";
    const traceId = "55555555-5555-4555-8555-555555555680";
    await bus.publish(
      sampleTask(runId, traceId, "Announce the Verse launch"),
      { topic: agentTasksTopic("nova") },
    );

    const completed = bus
      .getPublished(agentEventsTopic("nova"))
      .find((e) => e.event_type === "task.completed");
    assert.ok(completed);
    assert.equal(completed.payload.status, "completed");
    const result = completed.payload.result as { brand_facts?: string[] };
    assert.ok(Array.isArray(result.brand_facts));
    assert.ok(result.brand_facts!.some((f) => /premium|tone/i.test(f)));
    await runtime.stop();
  });

  it("content-campaign workflow pauses at checkpoint then resumes (Phase 26)", async () => {
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
      consumerGroup: "test-runtime-workflow",
    });

    const { executeWorkflowInline } = await import("./workflow-runner.js");
    const { CONTENT_CAMPAIGN_DEFINITION: def } = await import("@at72-verse/verse-core");

    const runId = "11111111-1111-4111-8111-111111111190";
    const traceId = "55555555-5555-4555-8555-555555555690";
    const paused = await executeWorkflowInline({
      core,
      definition: def,
      runId,
      organizationId: "org-1",
      workspaceId: "ws-1",
      traceId,
      brief: "Campagne article SEO et visuel Verse",
      grants_snapshot: testGrantsSnapshot(),
      budget_snapshot: testBudgetSnapshot(runId),
      packages_snapshot: testPackagesSnapshot(),
    });
    assert.equal(paused.status, "waiting_checkpoint");
    assert.ok(paused.completed_step_ids.includes("specialists"));
    const agg = (paused.step_outputs.specialists as { aggregate?: Record<string, unknown> })
      ?.aggregate;
    assert.deepEqual(Object.keys(agg ?? {}), ["nova", "astra", "pixel"]);

    for (const agentId of ["nova", "astra", "pixel"] as const) {
      const events = bus.getPublished(agentEventsTopic(agentId));
      assert.ok(events.some((e) => e.event_type === "task.delegated"), `${agentId} delegated`);
    }

    const done = await executeWorkflowInline({
      core,
      definition: def,
      runId,
      organizationId: "org-1",
      workspaceId: "ws-1",
      traceId,
      brief: "Campagne article SEO et visuel Verse",
      prior: paused,
      grants_snapshot: testGrantsSnapshot(),
      budget_snapshot: testBudgetSnapshot(runId),
      packages_snapshot: testPackagesSnapshot(),
    });
    assert.equal(done.status, "completed");
    assert.ok(done.completed_step_ids.includes("finalize"));
    await runtime.stop();
  });
});
