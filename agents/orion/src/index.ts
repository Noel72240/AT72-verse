/**
 * Agent Orion — analysis specialist (Phase 23 / DQ4).
 * Same handleTask model as Nova. Invokes skill.analysis explicitly.
 */
import type {
  AgentPlan,
  AgentTaskPayload,
  BusMessage,
  KernelClient,
  ResolvedPersona,
} from "@at72-verse/contracts";

export const ORION_AGENT_ID = "orion" as const;
export const ORION_ANALYSIS_SKILL_ID = "skill.analysis" as const;

export const ORION_PLAN: AgentPlan = {
  version: "1",
  steps: [
    { name: "invoke_analysis", kind: "skill", agent_id: ORION_AGENT_ID },
    { name: "deliver_insights", kind: "act", agent_id: ORION_AGENT_ID },
  ],
};

export type OrionHandleTaskContext = {
  kernel: KernelClient;
  message: BusMessage;
};

export type OrionHandleTaskResult = {
  plan: AgentPlan;
  result?: Record<string, unknown>;
  resolved_persona?: ResolvedPersona;
};

export async function handleTask(ctx: OrionHandleTaskContext): Promise<OrionHandleTaskResult> {
  const payload = ctx.message.payload as AgentTaskPayload;
  const runId = payload.run_id ?? ctx.message.run_id;
  if (!runId) {
    throw new Error("Orion handleTask requires run_id");
  }

  const resolved = await ctx.kernel.persona.resolve(ORION_AGENT_ID);

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
        : "Produce a short structured analysis.";

  const formality = resolved.spec.tone.formality;
  const rules =
    resolved.spec.rules.length > 0
      ? resolved.spec.rules.map((r) => `[${r.severity}] ${r.text}`).join("\n")
      : undefined;

  const taskFlags = payload as AgentTaskPayload & {
    use_web_search?: boolean;
    search_query?: string;
  };
  const useWebSearch = taskFlags.use_web_search === true;

  const invoked = await ctx.kernel.skills.invoke({
    skill_id: ORION_ANALYSIS_SKILL_ID,
    input: {
      brief,
      focus: "insights",
      ...(formality ? { formality } : {}),
      ...(rules ? { rules } : {}),
      ...(useWebSearch
        ? {
            use_web_search: true,
            ...(typeof taskFlags.search_query === "string"
              ? { search_query: taskFlags.search_query }
              : {}),
          }
        : {}),
    },
  });

  await ctx.kernel.events.emit("agent.orion.task.ready", {
    run_id: runId,
    trace_id: payload.trace_id ?? ctx.kernel.context.trace_id,
    skill_id: ORION_ANALYSIS_SKILL_ID,
  });

  return {
    plan: ORION_PLAN,
    result: invoked.output,
    resolved_persona: resolved,
  };
}

export const packageName = "@at72-verse/agent-orion" as const;
