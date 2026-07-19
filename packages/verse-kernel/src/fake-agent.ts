/**
 * Minimal fake agent cycle (Phase 07 Decision I):
 * LLM → Memory.remember → Memory.recall → Events.emit
 *
 * Demonstrates Kernel-only I/O before Verse Core exists.
 */
import type { KernelClient } from "@at72-verse/contracts";
import { createKernelClient } from "./create-kernel-client.js";
import type { StubKernelClient } from "./stub-kernel-client.js";

export type FakeAgentResult = {
  completion: string;
  rememberedId: string;
  recalledCount: number;
  callCount: number;
};

export async function runFakeAgentCycle(kernel: KernelClient): Promise<FakeAgentResult> {
  const completion = await kernel.llm.complete({
    profile: "stub-default",
    messages: [
      { role: "system", content: "You are a stub agent." },
      { role: "user", content: "Remember the keyword AT72-VERSE-KERNEL." },
    ],
  });

  const remembered = await kernel.memory.remember({
    scope: "run.working",
    content: "AT72-VERSE-KERNEL",
    type: "note",
  });

  const recalled = await kernel.memory.recall({
    scope: "run.working",
    query: "AT72-VERSE-KERNEL",
    limit: 5,
  });

  await kernel.events.emit("agent.fake.cycle.completed", {
    agent_id: kernel.context.agent_id,
    run_id: kernel.context.run_id,
    remembered_id: remembered.id,
    recalled: recalled.length,
  });

  const stub = kernel as StubKernelClient;
  return {
    completion: completion.content,
    rememberedId: remembered.id,
    recalledCount: recalled.length,
    callCount: stub.getCallHistory?.().length ?? 0,
  };
}

/** Convenience: create stub kernel + run fake cycle (for demos/tests). */
export async function runFakeAgentDemo(): Promise<FakeAgentResult> {
  const kernel = createKernelClient({
    context: {
      run_id: "00000000-0000-4000-8000-000000000001",
      agent_id: "agent.fake",
      organization_id: "00000000-0000-4000-8000-0000000000aa",
      workspace_id: "00000000-0000-4000-8000-0000000000bb",
      user_id: "00000000-0000-4000-8000-0000000000cc",
      trace_id: "00000000-0000-4000-8000-0000000000dd",
      span_id: "00000000-0000-4000-8000-0000000000ee",
    },
  });
  return runFakeAgentCycle(kernel);
}
