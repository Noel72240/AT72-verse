/**
 * Agent Neo — commercial / CRM (Phase 27c / DW2).
 * Persona → skill.crm-assist → Kernel.tools crm-sync (dry-run).
 */
import type {
  AgentPlan,
  AgentTaskPayload,
  BusMessage,
  KernelClient,
  ResolvedPersona,
} from "@at72-verse/contracts";

export const NEO_AGENT_ID = "neo" as const;
export const NEO_CRM_SKILL_ID = "skill.crm-assist" as const;

export const NEO_PLAN: AgentPlan = {
  version: "1",
  steps: [
    { name: "invoke_crm_assist", kind: "skill", agent_id: NEO_AGENT_ID },
    { name: "deliver_crm", kind: "act", agent_id: NEO_AGENT_ID },
  ],
};

export type NeoHandleTaskContext = {
  kernel: KernelClient;
  message: BusMessage;
};

export type NeoHandleTaskResult = {
  plan: AgentPlan;
  result?: Record<string, unknown>;
  resolved_persona?: ResolvedPersona;
};

export async function handleTask(ctx: NeoHandleTaskContext): Promise<NeoHandleTaskResult> {
  const payload = ctx.message.payload as AgentTaskPayload;
  const runId = payload.run_id ?? ctx.message.run_id;
  if (!runId) {
    throw new Error("Neo handleTask requires run_id");
  }

  const resolved = await ctx.kernel.persona.resolve(NEO_AGENT_ID);

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
        : "Qualify this inbound lead and propose next CRM steps.";

  const formality = resolved.spec.tone.formality;
  const rules =
    resolved.spec.rules.length > 0
      ? resolved.spec.rules.map((r) => `[${r.severity}] ${r.text}`).join("\n")
      : undefined;

  const taskFlags = payload as AgentTaskPayload & { object_type?: string; operation?: string };

  const invoked = await ctx.kernel.skills.invoke({
    skill_id: NEO_CRM_SKILL_ID,
    input: {
      brief,
      ...(typeof taskFlags.object_type === "string" ? { object_type: taskFlags.object_type } : {}),
      ...(typeof taskFlags.operation === "string" ? { operation: taskFlags.operation } : {}),
      ...(formality ? { formality } : {}),
      ...(rules ? { rules } : {}),
    },
  });

  await ctx.kernel.events.emit("agent.neo.task.ready", {
    run_id: runId,
    trace_id: payload.trace_id ?? ctx.kernel.context.trace_id,
    skill_id: NEO_CRM_SKILL_ID,
  });

  return {
    plan: NEO_PLAN,
    result: invoked.output,
    resolved_persona: resolved,
  };
}

export const packageName = "@at72-verse/agent-neo" as const;
