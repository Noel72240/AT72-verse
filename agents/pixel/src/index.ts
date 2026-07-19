/**
 * Agent Pixel — image / design specialist (Phase 23 / DQ4).
 */
import type {
  AgentPlan,
  AgentTaskPayload,
  BusMessage,
  KernelClient,
  ResolvedPersona,
} from "@at72-verse/contracts";

export const PIXEL_AGENT_ID = "pixel" as const;
export const PIXEL_IMAGE_SKILL_ID = "skill.image-generation" as const;

export const PIXEL_PLAN: AgentPlan = {
  version: "1",
  steps: [
    { name: "invoke_image_generation", kind: "skill", agent_id: PIXEL_AGENT_ID },
    { name: "deliver_visual", kind: "act", agent_id: PIXEL_AGENT_ID },
  ],
};

export type PixelHandleTaskContext = {
  kernel: KernelClient;
  message: BusMessage;
};

export type PixelHandleTaskResult = {
  plan: AgentPlan;
  result?: Record<string, unknown>;
  resolved_persona?: ResolvedPersona;
};

export async function handleTask(ctx: PixelHandleTaskContext): Promise<PixelHandleTaskResult> {
  const payload = ctx.message.payload as AgentTaskPayload;
  const runId = payload.run_id ?? ctx.message.run_id;
  if (!runId) {
    throw new Error("Pixel handleTask requires run_id");
  }

  const resolved = await ctx.kernel.persona.resolve(PIXEL_AGENT_ID);

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
        : "Create a visual brief for a brand asset.";

  const formality = resolved.spec.tone.formality;
  const rules =
    resolved.spec.rules.length > 0
      ? resolved.spec.rules.map((r) => `[${r.severity}] ${r.text}`).join("\n")
      : undefined;

  const taskFlags = payload as AgentTaskPayload & {
    use_image_generate?: boolean;
    aspect_ratio?: string;
    style?: string;
  };

  const invoked = await ctx.kernel.skills.invoke({
    skill_id: PIXEL_IMAGE_SKILL_ID,
    input: {
      brief,
      style: typeof taskFlags.style === "string" ? taskFlags.style : "clean modern",
      ...(formality ? { formality } : {}),
      ...(rules ? { rules } : {}),
      ...(taskFlags.use_image_generate === true
        ? {
            use_image_generate: true,
            ...(typeof taskFlags.aspect_ratio === "string"
              ? { aspect_ratio: taskFlags.aspect_ratio }
              : {}),
          }
        : {}),
    },
  });

  await ctx.kernel.events.emit("agent.pixel.task.ready", {
    run_id: runId,
    trace_id: payload.trace_id ?? ctx.kernel.context.trace_id,
    skill_id: PIXEL_IMAGE_SKILL_ID,
  });

  return {
    plan: PIXEL_PLAN,
    result: invoked.output,
    resolved_persona: resolved,
  };
}

export const packageName = "@at72-verse/agent-pixel" as const;
