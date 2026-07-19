/**
 * Agent Nova — specialist content agent (Phase 14 · 17 · 24 ask/consult).
 * Invokes skill.writing explicitly; may consult Astra via Kernel.orchestration.ask.
 */
import type {
  AgentPlan,
  AgentPlanStepSpec,
  AgentTaskPayload,
  BusMessage,
  KernelClient,
  ResolvedPersona,
} from "@at72-verse/contracts";

export const NOVA_AGENT_ID = "nova" as const;
export const NOVA_WRITING_SKILL_ID = "skill.writing" as const;

export function buildNovaPlan(consultSeo: boolean): AgentPlan {
  const steps: AgentPlanStepSpec[] = [
    { name: "invoke_writing", kind: "skill", agent_id: NOVA_AGENT_ID },
  ];
  if (consultSeo) {
    steps.push({ name: "consult_astra", kind: "consult", agent_id: "astra" });
  }
  steps.push({ name: "deliver_content", kind: "act", agent_id: NOVA_AGENT_ID });
  return { version: "1", steps };
}

/** @deprecated Prefer buildNovaPlan — default without consult. */
export const NOVA_PLAN: AgentPlan = buildNovaPlan(false);

export type NovaHandleTaskContext = {
  kernel: KernelClient;
  message: BusMessage;
};

export type NovaHandleTaskResult = {
  plan: AgentPlan;
  result?: Record<string, unknown>;
  resolved_persona?: ResolvedPersona;
};

/**
 * Explicit skill binding (BG1) — no auto-invoke of manifest skills.
 */
export async function handleTask(ctx: NovaHandleTaskContext): Promise<NovaHandleTaskResult> {
  const payload = ctx.message.payload as AgentTaskPayload;
  const runId = payload.run_id ?? ctx.message.run_id;
  if (!runId) {
    throw new Error("Nova handleTask requires run_id");
  }

  const resolved = await ctx.kernel.persona.resolve(NOVA_AGENT_ID);

  const recalled = await ctx.kernel.memory.recall({
    scope: "run.working",
    query: "",
    limit: 5,
  });
  const fromMemory = recalled[0]?.content?.trim();

  const brandHits = await ctx.kernel.memory.recall({
    scope: "org.brand",
    query: "tone of voice brand",
    limit: 3,
  });
  const brandFacts = brandHits
    .map((r) => r.content.trim())
    .filter((c) => c.length > 0);

  const brief =
    fromMemory && fromMemory.length > 0
      ? fromMemory
      : typeof payload.goal === "string" && payload.goal.trim().length > 0
        ? payload.goal.trim()
        : "Write a short professional announcement.";

  const formality = resolved.spec.tone.formality;
  const tone = resolved.spec.tone.voice ?? "professional";
  const personaRules =
    resolved.spec.rules.length > 0
      ? resolved.spec.rules.map((r) => `[${r.severity}] ${r.text}`)
      : [];
  const brandRules = brandFacts.map((f) => `[brand] ${f}`);
  const rulesBlock = [...personaRules, ...brandRules].join("\n") || undefined;

  const taskFlags = payload as AgentTaskPayload & {
    use_web_search?: boolean;
    search_query?: string;
    consult_seo?: boolean;
  };
  const useWebSearch = taskFlags.use_web_search === true;
  const consultSeo = taskFlags.consult_seo === true;

  const invoked = await ctx.kernel.skills.invoke({
    skill_id: NOVA_WRITING_SKILL_ID,
    input: {
      brief,
      format: "prose",
      tone,
      ...(formality ? { formality } : {}),
      ...(rulesBlock ? { rules: rulesBlock } : {}),
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

  let result: Record<string, unknown> = {
    ...invoked.output,
    ...(brandFacts.length > 0
      ? {
          brand_facts: brandFacts,
          brand_explanations: brandHits.map((h) => h.explanation ?? null),
        }
      : {}),
  };
  if (consultSeo) {
    const consulted = await ctx.kernel.orchestration.ask("astra", {
      question: "Review this draft for SEO recommendations",
      brief: String(invoked.output.content ?? brief),
      url: "https://example.com/draft",
    });
    if (consulted.status !== "completed") {
      throw new Error(consulted.error ?? "Astra consult failed");
    }
    result = {
      ...result,
      seo_consult: consulted.answer,
    };
  }

  await ctx.kernel.events.emit("agent.nova.task.ready", {
    run_id: runId,
    trace_id: payload.trace_id ?? ctx.kernel.context.trace_id,
    skill_id: NOVA_WRITING_SKILL_ID,
    consult_seo: consultSeo,
  });

  return {
    plan: buildNovaPlan(consultSeo),
    result,
    resolved_persona: resolved,
  };
}

export const packageName = "@at72-verse/agent-nova" as const;
