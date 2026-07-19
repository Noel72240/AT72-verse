/**
 * Agent Echo — local / Google Business specialist (Phase 27a / DU3).
 * Persona → skill.local-presence → Kernel.tools gmb-sync (dry-run).
 */
import type {
  AgentPlan,
  AgentTaskPayload,
  BusMessage,
  KernelClient,
  ResolvedPersona,
} from "@at72-verse/contracts";

export const ECHO_AGENT_ID = "echo" as const;
export const ECHO_LOCAL_SKILL_ID = "skill.local-presence" as const;

export const ECHO_PLAN: AgentPlan = {
  version: "1",
  steps: [
    { name: "invoke_local_presence", kind: "skill", agent_id: ECHO_AGENT_ID },
    { name: "deliver_local", kind: "act", agent_id: ECHO_AGENT_ID },
  ],
};

export type EchoHandleTaskContext = {
  kernel: KernelClient;
  message: BusMessage;
};

export type EchoHandleTaskResult = {
  plan: AgentPlan;
  result?: Record<string, unknown>;
  resolved_persona?: ResolvedPersona;
};

export async function handleTask(ctx: EchoHandleTaskContext): Promise<EchoHandleTaskResult> {
  const payload = ctx.message.payload as AgentTaskPayload;
  const runId = payload.run_id ?? ctx.message.run_id;
  if (!runId) {
    throw new Error("Echo handleTask requires run_id");
  }

  const resolved = await ctx.kernel.persona.resolve(ECHO_AGENT_ID);

  const recalled = await ctx.kernel.memory.recall({
    scope: "run.working",
    query: "",
    limit: 5,
  });
  const fromMemory = recalled[0]?.content?.trim();

  const brief =
    fromMemory && fromMemory.length > 0
      ? fromMemory
      : typeof payload.goal === "string" && payload.goal.trim().length > 0
        ? payload.goal.trim()
        : "Improve the Google Business listing for the local store.";

  const formality = resolved.spec.tone.formality;
  const rules =
    resolved.spec.rules.length > 0
      ? resolved.spec.rules.map((r) => `[${r.severity}] ${r.text}`).join("\n")
      : undefined;

  const taskFlags = payload as AgentTaskPayload & { place_id?: string };

  const invoked = await ctx.kernel.skills.invoke({
    skill_id: ECHO_LOCAL_SKILL_ID,
    input: {
      brief,
      ...(typeof taskFlags.place_id === "string" ? { place_id: taskFlags.place_id } : {}),
      ...(formality ? { formality } : {}),
      ...(rules ? { rules } : {}),
    },
  });

  await ctx.kernel.events.emit("agent.echo.task.ready", {
    run_id: runId,
    trace_id: payload.trace_id ?? ctx.kernel.context.trace_id,
    skill_id: ECHO_LOCAL_SKILL_ID,
  });

  return {
    plan: ECHO_PLAN,
    result: invoked.output,
    resolved_persona: resolved,
  };
}

export const packageName = "@at72-verse/agent-echo" as const;
