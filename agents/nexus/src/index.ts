/**
 * Agent Nexus — automation planner (Phase 27b / DV4).
 * Persona → skill.automation-plan → Kernel.tools http-request (dry-run).
 * Never executes automations — plans and recommendations only.
 */
import type {
  AgentPlan,
  AgentTaskPayload,
  BusMessage,
  KernelClient,
  ResolvedPersona,
} from "@at72-verse/contracts";

export const NEXUS_AGENT_ID = "nexus" as const;
export const NEXUS_AUTOMATION_SKILL_ID = "skill.automation-plan" as const;

export const NEXUS_PLAN: AgentPlan = {
  version: "1",
  steps: [
    { name: "invoke_automation_plan", kind: "skill", agent_id: NEXUS_AGENT_ID },
    { name: "deliver_plan", kind: "act", agent_id: NEXUS_AGENT_ID },
  ],
};

export type NexusHandleTaskContext = {
  kernel: KernelClient;
  message: BusMessage;
};

export type NexusHandleTaskResult = {
  plan: AgentPlan;
  result?: Record<string, unknown>;
  resolved_persona?: ResolvedPersona;
};

export async function handleTask(ctx: NexusHandleTaskContext): Promise<NexusHandleTaskResult> {
  const payload = ctx.message.payload as AgentTaskPayload;
  const runId = payload.run_id ?? ctx.message.run_id;
  if (!runId) {
    throw new Error("Nexus handleTask requires run_id");
  }

  const resolved = await ctx.kernel.persona.resolve(NEXUS_AGENT_ID);

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
        : "Plan a webhook automation for form submissions.";

  const formality = resolved.spec.tone.formality;
  const rules =
    resolved.spec.rules.length > 0
      ? resolved.spec.rules.map((r) => `[${r.severity}] ${r.text}`).join("\n")
      : undefined;

  const taskFlags = payload as AgentTaskPayload & { target_url?: string; method?: string };

  const invoked = await ctx.kernel.skills.invoke({
    skill_id: NEXUS_AUTOMATION_SKILL_ID,
    input: {
      brief,
      ...(typeof taskFlags.target_url === "string" ? { target_url: taskFlags.target_url } : {}),
      ...(typeof taskFlags.method === "string" ? { method: taskFlags.method } : {}),
      ...(formality ? { formality } : {}),
      ...(rules ? { rules } : {}),
    },
  });

  await ctx.kernel.events.emit("agent.nexus.task.ready", {
    run_id: runId,
    trace_id: payload.trace_id ?? ctx.kernel.context.trace_id,
    skill_id: NEXUS_AUTOMATION_SKILL_ID,
  });

  return {
    plan: NEXUS_PLAN,
    result: invoked.output,
    resolved_persona: resolved,
  };
}

export const packageName = "@at72-verse/agent-nexus" as const;
