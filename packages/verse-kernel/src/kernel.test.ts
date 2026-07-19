import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createKernelClient } from "./create-kernel-client.js";
import { runFakeAgentCycle, runFakeAgentDemo } from "./fake-agent.js";
import type { StubKernelClient } from "./stub-kernel-client.js";

const fixedContext = {
  run_id: "11111111-1111-4111-8111-111111111111",
  agent_id: "agent.test",
  organization_id: "22222222-2222-4222-8222-222222222222",
  workspace_id: "33333333-3333-4333-8333-333333333333",
  user_id: "44444444-4444-4444-8444-444444444444",
  trace_id: "55555555-5555-4555-8555-555555555555",
  span_id: "66666666-6666-4666-8666-666666666666",
} as const;

describe("@at72-verse/verse-kernel Phase 07", () => {
  it("createKernelClient injects full context (agents do not pass it on syscalls)", () => {
    const kernel = createKernelClient({ context: { ...fixedContext } });
    assert.equal(kernel.context.run_id, fixedContext.run_id);
    assert.equal(kernel.context.organization_id, fixedContext.organization_id);
    assert.equal(kernel.context.tenant_id, fixedContext.organization_id);
    assert.equal(kernel.context.trace_id, fixedContext.trace_id);
    assert.equal(kernel.context.user_id, fixedContext.user_id);
  });

  it("stub llm.complete is deterministic for the same input", async () => {
    const a = createKernelClient({ context: { ...fixedContext } });
    const b = createKernelClient({ context: { ...fixedContext } });
    const req = {
      profile: "p1",
      messages: [{ role: "user" as const, content: "hello deterministic" }],
    };
    const r1 = await a.llm.complete(req);
    const r2 = await b.llm.complete(req);
    assert.equal(r1.content, r2.content);
    assert.equal(r1.usage.input_tokens, r2.usage.input_tokens);
  });

  it("records call history with context on every syscall", async () => {
    const kernel = createKernelClient({
      context: { ...fixedContext },
    }) as StubKernelClient;
    await kernel.llm.complete({
      profile: "p1",
      messages: [{ role: "user", content: "trace me" }],
    });
    const history = kernel.getCallHistory();
    assert.equal(history.length, 1);
    assert.equal(history[0]?.family, "llm");
    assert.equal(history[0]?.success, true);
    assert.equal(history[0]?.context.run_id, fixedContext.run_id);
    assert.equal(history[0]?.context.trace_id, fixedContext.trace_id);
    assert.ok(typeof history[0]?.duration_ms === "number");
  });

  it("fake agent cycle: LLM → remember → recall → emit", async () => {
    const kernel = createKernelClient({
      context: { ...fixedContext },
    }) as StubKernelClient;
    const result = await runFakeAgentCycle(kernel);
    assert.ok(result.completion.includes("stub:"));
    assert.ok(result.rememberedId.startsWith("mem_"));
    assert.equal(result.recalledCount, 1);
    assert.ok(result.callCount >= 4);

    const methods = kernel.getCallHistory().map((c) => `${c.family}.${c.method}`);
    assert.ok(methods.includes("llm.complete"));
    assert.ok(methods.includes("memory.remember"));
    assert.ok(methods.includes("memory.recall"));
    assert.ok(methods.includes("events.emit"));

    const events = kernel.getEmittedEvents();
    assert.equal(events.length, 1);
    assert.equal(events[0]?.eventType, "agent.fake.cycle.completed");
  });

  it("runFakeAgentDemo completes successfully", async () => {
    const result = await runFakeAgentDemo();
    assert.ok(result.recalledCount >= 1);
  });

  it("backend=core without coreFactory fails closed", () => {
    assert.throws(
      () =>
        createKernelClient({
          context: { ...fixedContext },
          backend: "core",
        }),
      (err: unknown) =>
        err instanceof Error &&
        err.name === "KernelError" &&
        (err as { code?: string }).code === "UNAVAILABLE",
    );
  });

  it("default backend remains stub (CI reference)", async () => {
    const kernel = createKernelClient({ context: { ...fixedContext } });
    const r = await kernel.llm.complete({
      profile: "p1",
      messages: [{ role: "user", content: "stub default" }],
    });
    assert.ok(r.content.includes("stub:"));
  });
});
