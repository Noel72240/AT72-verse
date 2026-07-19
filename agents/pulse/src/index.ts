/**
 * Agent Pulse — social scheduling specialist (Phase 27a / DU3).
 * Persona → skill.social-scheduling → Kernel.tools social-publish (dry-run).
 */
import type {
  AgentPlan,
  AgentTaskPayload,
  BusMessage,
  KernelClient,
  ResolvedPersona,
} from "@at72-verse/contracts";

export const PULSE_AGENT_ID = "pulse" as const;
export const PULSE_SOCIAL_SKILL_ID = "skill.social-scheduling" as const;

export const PULSE_PLAN: AgentPlan = {
  version: "1",
  steps: [
    { name: "invoke_social_scheduling", kind: "skill", agent_id: PULSE_AGENT_ID },
    { name: "deliver_schedule", kind: "act", agent_id: PULSE_AGENT_ID },
  ],
};

export type PulseHandleTaskContext = {
  kernel: KernelClient;
  message: BusMessage;
};

export type PulseHandleTaskResult = {
  plan: AgentPlan;
  result?: Record<string, unknown>;
  resolved_persona?: ResolvedPersona;
};

export async function handleTask(ctx: PulseHandleTaskContext): Promise<PulseHandleTaskResult> {
  const payload = ctx.message.payload as AgentTaskPayload;
  const runId = payload.run_id ?? ctx.message.run_id;
  if (!runId) {
    throw new Error("Pulse handleTask requires run_id");
  }

  const resolved = await ctx.kernel.persona.resolve(PULSE_AGENT_ID);

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
        : "Plan a short LinkedIn post calendar.";

  const formality = resolved.spec.tone.formality;
  const rules =
    resolved.spec.rules.length > 0
      ? resolved.spec.rules.map((r) => `[${r.severity}] ${r.text}`).join("\n")
      : undefined;

  const taskFlags = payload as AgentTaskPayload & { platform?: string; mode?: string };

  const invoked = await ctx.kernel.skills.invoke({
    skill_id: PULSE_SOCIAL_SKILL_ID,
    input: {
      brief,
      ...(typeof taskFlags.platform === "string" ? { platform: taskFlags.platform } : {}),
      ...(taskFlags.mode === "live" || taskFlags.mode === "dry_run"
        ? { mode: taskFlags.mode }
        : {}),
      ...(formality ? { formality } : {}),
      ...(rules ? { rules } : {}),
    },
  });

  await ctx.kernel.events.emit("agent.pulse.task.ready", {
    run_id: runId,
    trace_id: payload.trace_id ?? ctx.kernel.context.trace_id,
    skill_id: PULSE_SOCIAL_SKILL_ID,
  });

  return {
    plan: PULSE_PLAN,
    result: invoked.output,
    resolved_persona: resolved,
  };
}

export const packageName = "@at72-verse/agent-pulse" as const;
