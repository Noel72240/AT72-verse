/**
 * Agent Astra — SEO specialist (Phase 23 / DQ4).
 */
import type {
  AgentPlan,
  AgentTaskPayload,
  BusMessage,
  KernelClient,
  ResolvedPersona,
} from "@at72-verse/contracts";

export const ASTRA_AGENT_ID = "astra" as const;
export const ASTRA_SEO_SKILL_ID = "skill.seo" as const;

export const ASTRA_PLAN: AgentPlan = {
  version: "1",
  steps: [
    { name: "invoke_seo", kind: "skill", agent_id: ASTRA_AGENT_ID },
    { name: "deliver_seo", kind: "act", agent_id: ASTRA_AGENT_ID },
  ],
};

export type AstraHandleTaskContext = {
  kernel: KernelClient;
  message: BusMessage;
};

export type AstraHandleTaskResult = {
  plan: AgentPlan;
  result?: Record<string, unknown>;
  resolved_persona?: ResolvedPersona;
};

export async function handleTask(ctx: AstraHandleTaskContext): Promise<AstraHandleTaskResult> {
  const payload = ctx.message.payload as AgentTaskPayload;
  const runId = payload.run_id ?? ctx.message.run_id;
  if (!runId) {
    throw new Error("Astra handleTask requires run_id");
  }

  const resolved = await ctx.kernel.persona.resolve(ASTRA_AGENT_ID);

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
        : "Audit SEO for the target page.";

  const formality = resolved.spec.tone.formality;
  const rules =
    resolved.spec.rules.length > 0
      ? resolved.spec.rules.map((r) => `[${r.severity}] ${r.text}`).join("\n")
      : undefined;

  const taskFlags = payload as AgentTaskPayload & {
    url?: string;
    use_web_search?: boolean;
    search_query?: string;
  };

  const invoked = await ctx.kernel.skills.invoke({
    skill_id: ASTRA_SEO_SKILL_ID,
    input: {
      brief,
      ...(typeof taskFlags.url === "string" ? { url: taskFlags.url } : {}),
      ...(formality ? { formality } : {}),
      ...(rules ? { rules } : {}),
      ...(taskFlags.use_web_search === true
        ? {
            use_web_search: true,
            ...(typeof taskFlags.search_query === "string"
              ? { search_query: taskFlags.search_query }
              : {}),
          }
        : {}),
    },
  });

  await ctx.kernel.events.emit("agent.astra.task.ready", {
    run_id: runId,
    trace_id: payload.trace_id ?? ctx.kernel.context.trace_id,
    skill_id: ASTRA_SEO_SKILL_ID,
  });

  return {
    plan: ASTRA_PLAN,
    result: invoked.output,
    resolved_persona: resolved,
  };
}

export const packageName = "@at72-verse/agent-astra" as const;
