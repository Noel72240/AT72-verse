/**
 * Agent Nyx — video brief / storyboard (Phase 27c / DW4).
 * Persona → skill.video-brief → Kernel.tools video-pipeline (dry-run, never renders).
 */
import type {
  AgentPlan,
  AgentTaskPayload,
  BusMessage,
  KernelClient,
  ResolvedPersona,
} from "@at72-verse/contracts";

export const NYX_AGENT_ID = "nyx" as const;
export const NYX_VIDEO_SKILL_ID = "skill.video-brief" as const;

export const NYX_PLAN: AgentPlan = {
  version: "1",
  steps: [
    { name: "invoke_video_brief", kind: "skill", agent_id: NYX_AGENT_ID },
    { name: "deliver_storyboard", kind: "act", agent_id: NYX_AGENT_ID },
  ],
};

export type NyxHandleTaskContext = {
  kernel: KernelClient;
  message: BusMessage;
};

export type NyxHandleTaskResult = {
  plan: AgentPlan;
  result?: Record<string, unknown>;
  resolved_persona?: ResolvedPersona;
};

export async function handleTask(ctx: NyxHandleTaskContext): Promise<NyxHandleTaskResult> {
  const payload = ctx.message.payload as AgentTaskPayload;
  const runId = payload.run_id ?? ctx.message.run_id;
  if (!runId) {
    throw new Error("Nyx handleTask requires run_id");
  }

  const resolved = await ctx.kernel.persona.resolve(NYX_AGENT_ID);

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
        : "Create a short product launch storyboard.";

  const formality = resolved.spec.tone.formality;
  const rules =
    resolved.spec.rules.length > 0
      ? resolved.spec.rules.map((r) => `[${r.severity}] ${r.text}`).join("\n")
      : undefined;

  const taskFlags = payload as AgentTaskPayload & { format?: string; duration_s?: number };

  const invoked = await ctx.kernel.skills.invoke({
    skill_id: NYX_VIDEO_SKILL_ID,
    input: {
      brief,
      ...(typeof taskFlags.format === "string" ? { format: taskFlags.format } : {}),
      ...(typeof taskFlags.duration_s === "number" ? { duration_s: taskFlags.duration_s } : {}),
      ...(formality ? { formality } : {}),
      ...(rules ? { rules } : {}),
    },
  });

  await ctx.kernel.events.emit("agent.nyx.task.ready", {
    run_id: runId,
    trace_id: payload.trace_id ?? ctx.kernel.context.trace_id,
    skill_id: NYX_VIDEO_SKILL_ID,
  });

  return {
    plan: NYX_PLAN,
    result: invoked.output,
    resolved_persona: resolved,
  };
}

export const packageName = "@at72-verse/agent-nyx" as const;
