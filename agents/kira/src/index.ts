/**
 * Agent Kira — support triage (Phase 27c / DW2 · DW5).
 * Persona → skill.support-triage → Kernel.llm (no dedicated tool).
 * May consult Neo via Kernel.orchestration.ask when consult_neo=true.
 */
import type {
  AgentPlan,
  AgentPlanStepSpec,
  AgentTaskPayload,
  BusMessage,
  KernelClient,
  ResolvedPersona,
} from "@at72-verse/contracts";

export const KIRA_AGENT_ID = "kira" as const;
export const KIRA_TRIAGE_SKILL_ID = "skill.support-triage" as const;

export function buildKiraPlan(consultNeo: boolean): AgentPlan {
  const steps: AgentPlanStepSpec[] = [
    { name: "invoke_support_triage", kind: "skill", agent_id: KIRA_AGENT_ID },
  ];
  if (consultNeo) {
    steps.push({ name: "consult_neo", kind: "consult", agent_id: "neo" });
  }
  steps.push({ name: "deliver_triage", kind: "act", agent_id: KIRA_AGENT_ID });
  return { version: "1", steps };
}

export const KIRA_PLAN: AgentPlan = buildKiraPlan(false);

export type KiraHandleTaskContext = {
  kernel: KernelClient;
  message: BusMessage;
};

export type KiraHandleTaskResult = {
  plan: AgentPlan;
  result?: Record<string, unknown>;
  resolved_persona?: ResolvedPersona;
};

export async function handleTask(ctx: KiraHandleTaskContext): Promise<KiraHandleTaskResult> {
  const payload = ctx.message.payload as AgentTaskPayload;
  const runId = payload.run_id ?? ctx.message.run_id;
  if (!runId) {
    throw new Error("Kira handleTask requires run_id");
  }

  const resolved = await ctx.kernel.persona.resolve(KIRA_AGENT_ID);

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
        : "Triage this support ticket.";

  const formality = resolved.spec.tone.formality;
  const rules =
    resolved.spec.rules.length > 0
      ? resolved.spec.rules.map((r) => `[${r.severity}] ${r.text}`).join("\n")
      : undefined;

  const taskFlags = payload as AgentTaskPayload & { consult_neo?: boolean };
  const consultNeo = taskFlags.consult_neo === true;

  const invoked = await ctx.kernel.skills.invoke({
    skill_id: KIRA_TRIAGE_SKILL_ID,
    input: {
      brief,
      ...(formality ? { formality } : {}),
      ...(rules ? { rules } : {}),
    },
  });

  const result: Record<string, unknown> = { ...(invoked.output as Record<string, unknown>) };

  if (consultNeo) {
    const consulted = await ctx.kernel.orchestration.ask("neo", {
      goal: `Sales handoff from support triage: ${brief.slice(0, 200)}`,
      context: { triage: invoked.output },
    });
    if (consulted.status !== "completed") {
      throw new Error(consulted.error ?? "Neo consult failed");
    }
    result.neo_consult = consulted.answer;
  }

  await ctx.kernel.events.emit("agent.kira.task.ready", {
    run_id: runId,
    trace_id: payload.trace_id ?? ctx.kernel.context.trace_id,
    skill_id: KIRA_TRIAGE_SKILL_ID,
    consult_neo: consultNeo,
  });

  return {
    plan: buildKiraPlan(consultNeo),
    result,
    resolved_persona: resolved,
  };
}

export const packageName = "@at72-verse/agent-kira" as const;
