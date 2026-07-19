/**
 * Agent Vega — strategic watch (Phase 27b / DV5).
 * Persona → skill.watch-brief → Kernel.tools web-search (default on).
 */
import type {
  AgentPlan,
  AgentTaskPayload,
  BusMessage,
  KernelClient,
  ResolvedPersona,
} from "@at72-verse/contracts";

export const VEGA_AGENT_ID = "vega" as const;
export const VEGA_WATCH_SKILL_ID = "skill.watch-brief" as const;

export const VEGA_PLAN: AgentPlan = {
  version: "1",
  steps: [
    { name: "invoke_watch_brief", kind: "skill", agent_id: VEGA_AGENT_ID },
    { name: "deliver_brief", kind: "act", agent_id: VEGA_AGENT_ID },
  ],
};

export type VegaHandleTaskContext = {
  kernel: KernelClient;
  message: BusMessage;
};

export type VegaHandleTaskResult = {
  plan: AgentPlan;
  result?: Record<string, unknown>;
  resolved_persona?: ResolvedPersona;
};

export async function handleTask(ctx: VegaHandleTaskContext): Promise<VegaHandleTaskResult> {
  const payload = ctx.message.payload as AgentTaskPayload;
  const runId = payload.run_id ?? ctx.message.run_id;
  if (!runId) {
    throw new Error("Vega handleTask requires run_id");
  }

  const resolved = await ctx.kernel.persona.resolve(VEGA_AGENT_ID);

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
        : "Produce a strategic watch brief on competitor messaging.";

  const formality = resolved.spec.tone.formality;
  const rules =
    resolved.spec.rules.length > 0
      ? resolved.spec.rules.map((r) => `[${r.severity}] ${r.text}`).join("\n")
      : undefined;

  const taskFlags = payload as AgentTaskPayload & {
    use_web_search?: boolean;
    search_query?: string;
  };

  const invoked = await ctx.kernel.skills.invoke({
    skill_id: VEGA_WATCH_SKILL_ID,
    input: {
      brief,
      // default ON unless explicitly false
      use_web_search: taskFlags.use_web_search !== false,
      ...(typeof taskFlags.search_query === "string" ? { search_query: taskFlags.search_query } : {}),
      ...(formality ? { formality } : {}),
      ...(rules ? { rules } : {}),
    },
  });

  await ctx.kernel.events.emit("agent.vega.task.ready", {
    run_id: runId,
    trace_id: payload.trace_id ?? ctx.kernel.context.trace_id,
    skill_id: VEGA_WATCH_SKILL_ID,
  });

  return {
    plan: VEGA_PLAN,
    result: invoked.output,
    resolved_persona: resolved,
  };
}

export const packageName = "@at72-verse/agent-vega" as const;
