/**
 * Adam orchestrator (Phase 15 · 23 · 24) — plans via LLM, delegates / fan-out via Kernel.
 * I/O only via Kernel — no infra imports (AQ1). Never invokes skills directly (BW1).
 */
import type {
  AgentPlan,
  AgentPlanStepSpec,
  AgentTaskPayload,
  BusMessage,
  KernelClient,
  ResolvedPersona,
} from "@at72-verse/contracts";

export const ADAM_AGENT_ID = "adam" as const;

/** Specialists Adam may choose (DQ3 / DR7) — depth max 1. */
export const ADAM_SPECIALIST_IDS = ["nova", "orion", "astra", "pixel"] as const;
export type AdamSpecialistId = (typeof ADAM_SPECIALIST_IDS)[number];
export type AdamDelegateTarget = AdamSpecialistId | "none";

/** Campaign fan-out order (deterministic structure for replay). */
export const ADAM_CAMPAIGN_TARGETS: readonly AdamSpecialistId[] = [
  "nova",
  "astra",
  "pixel",
] as const;

/** @deprecated Prefer buildAdamPlan — kept for test references to step names. */
export const ADAM_DETERMINISTIC_PLAN: AgentPlan = {
  version: "1",
  steps: [
    { name: "analyze_goal", kind: "reason" },
    { name: "draft_orchestration_plan", kind: "plan" },
    { name: "ready_for_delegation", kind: "act" },
  ],
};

export const ADAM_PLANNER_SYSTEM = `You are Adam, the Verse orchestrator.
Return ONLY a JSON object (no markdown) with this shape:
{"mode":"campaign"|"single"|"none","delegate_to":"nova"|"orion"|"astra"|"pixel"|"none","targets":["nova","astra","pixel"],"brief":"<shared brief>","briefs":{"nova":"...","astra":"...","pixel":"..."},"summary":"<one-line plan>"}
Rules:
- Full content campaign (article + SEO + visual) → mode "campaign" with targets nova,astra,pixel
- Content / LinkedIn / post / article / writing only → mode "single", delegate_to "nova"
- Analysis / data / insights → mode "single", delegate_to "orion"
- SEO / audit / ranking alone → mode "single", delegate_to "astra"
- Image / visual / design alone → mode "single", delegate_to "pixel"
- Otherwise mode "none"
- Choose at most one mode. Never invent other agents.`;

export type AdamHandleTaskContext = {
  kernel: KernelClient;
  message: BusMessage;
};

export type AdamHandleTaskResult = {
  plan: AgentPlan;
  result?: Record<string, unknown>;
  resolved_persona?: ResolvedPersona;
};

export type AdamLlmPlan = {
  mode: "campaign" | "single" | "none";
  delegate_to: AdamDelegateTarget;
  targets?: AdamSpecialistId[];
  brief?: string;
  briefs?: Partial<Record<AdamSpecialistId, string>>;
  summary?: string;
};

function isSpecialist(value: string): value is AdamSpecialistId {
  return (ADAM_SPECIALIST_IDS as readonly string[]).includes(value);
}

export function buildAdamPlan(llmPlan: AdamLlmPlan): AgentPlan {
  const steps: AgentPlanStepSpec[] = [
    { name: "analyze_goal", kind: "reason", agent_id: ADAM_AGENT_ID },
    { name: "draft_orchestration_plan", kind: "plan", agent_id: ADAM_AGENT_ID },
  ];
  if (llmPlan.mode === "campaign") {
    const targets = llmPlan.targets?.length
      ? llmPlan.targets.filter(isSpecialist)
      : [...ADAM_CAMPAIGN_TARGETS];
    for (const t of targets) {
      steps.push({ name: `delegate_${t}`, kind: "delegate", agent_id: t });
    }
  } else if (llmPlan.mode === "single" && llmPlan.delegate_to !== "none") {
    steps.push({
      name: `delegate_${llmPlan.delegate_to}`,
      kind: "delegate",
      agent_id: llmPlan.delegate_to,
    });
  }
  steps.push({ name: "aggregate_result", kind: "act", agent_id: ADAM_AGENT_ID });
  return { version: "1", steps };
}

export function parseAdamLlmPlan(content: string, goal: string): AdamLlmPlan {
  const trimmed = content.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      const modeRaw = typeof parsed.mode === "string" ? parsed.mode.toLowerCase() : "";
      const raw =
        typeof parsed.delegate_to === "string" ? parsed.delegate_to.toLowerCase() : "none";
      const delegate_to: AdamDelegateTarget = isSpecialist(raw) ? raw : "none";
      const targets = Array.isArray(parsed.targets)
        ? parsed.targets.filter((t): t is AdamSpecialistId => typeof t === "string" && isSpecialist(t))
        : undefined;
      let mode: AdamLlmPlan["mode"] = "none";
      if (modeRaw === "campaign" || (targets && targets.length > 1)) {
        mode = "campaign";
      } else if (modeRaw === "single" || delegate_to !== "none") {
        mode = "single";
      }
      const briefs =
        parsed.briefs && typeof parsed.briefs === "object" && !Array.isArray(parsed.briefs)
          ? (parsed.briefs as Partial<Record<AdamSpecialistId, string>>)
          : undefined;
      return {
        mode,
        delegate_to: mode === "campaign" ? "none" : delegate_to,
        targets: mode === "campaign" ? targets?.length ? targets : [...ADAM_CAMPAIGN_TARGETS] : undefined,
        brief: typeof parsed.brief === "string" ? parsed.brief : undefined,
        briefs,
        summary: typeof parsed.summary === "string" ? parsed.summary : undefined,
      };
    } catch {
      /* fall through */
    }
  }
  return heuristicPlan(goal);
}

function heuristicPlan(goal: string): AdamLlmPlan {
  const g = goal.toLowerCase();
  if (
    /campagne|campaign|(article|contenu).*(seo|visuel|image)|(seo).*(visuel|image|design)/.test(g)
  ) {
    return {
      mode: "campaign",
      delegate_to: "none",
      targets: [...ADAM_CAMPAIGN_TARGETS],
      brief: goal,
      summary: "Fan-out campaign Nova + Astra + Pixel",
    };
  }
  if (/seo|serp|ranking|audit.?seo|référencement|referencement/.test(g)) {
    return { mode: "single", delegate_to: "astra", brief: goal, summary: "Delegate SEO to Astra" };
  }
  if (/image|visuel|visual|illustration|design|banner|logo/.test(g)) {
    return { mode: "single", delegate_to: "pixel", brief: goal, summary: "Delegate image to Pixel" };
  }
  if (/analys|insight|rapport|report|données|data|métrique|metric/.test(g)) {
    return {
      mode: "single",
      delegate_to: "orion",
      brief: goal,
      summary: "Delegate analysis to Orion",
    };
  }
  if (/linkedin|rédige|redige|write|post|poste|article|blog|content|contenu|annonce|réseau|reseau|social/.test(g)) {
    return { mode: "single", delegate_to: "nova", brief: goal, summary: "Delegate writing to Nova" };
  }
  return { mode: "none", delegate_to: "none", summary: "Direct conversational reply" };
}

function briefFor(
  plan: AdamLlmPlan,
  agentId: AdamSpecialistId,
  fallbackGoal: string,
): string {
  const fromMap = plan.briefs?.[agentId];
  if (typeof fromMap === "string" && fromMap.trim()) return fromMap.trim();
  if (plan.brief?.trim()) return plan.brief.trim();
  return fallbackGoal;
}

/**
 * Minimal agent entrypoint. Plans with LLM; may await one or many specialists.
 */
export async function handleTask(ctx: AdamHandleTaskContext): Promise<AdamHandleTaskResult> {
  const payload = ctx.message.payload as AgentTaskPayload;
  const runId = payload.run_id ?? ctx.message.run_id;
  if (!runId) {
    throw new Error("Adam handleTask requires run_id");
  }

  const resolved = await ctx.kernel.persona.resolve(ADAM_AGENT_ID);

  const goal =
    typeof payload.goal === "string" && payload.goal.trim().length > 0
      ? payload.goal.trim()
      : "No goal provided.";

  const completion = await ctx.kernel.llm.complete({
    profile: "orchestrate-precise",
    messages: [
      { role: "system", content: ADAM_PLANNER_SYSTEM },
      { role: "user", content: goal },
    ],
  });

  const llmPlan = parseAdamLlmPlan(completion.content, goal);
  const plan = buildAdamPlan(llmPlan);

  await ctx.kernel.events.emit("agent.adam.plan.ready", {
    run_id: runId,
    trace_id: payload.trace_id ?? ctx.kernel.context.trace_id,
    plan,
    summary: llmPlan.summary ?? null,
  });

  if (llmPlan.mode === "campaign") {
    const targets = (llmPlan.targets?.length ? llmPlan.targets : [...ADAM_CAMPAIGN_TARGETS]).filter(
      isSpecialist,
    );
    // Deterministic fan-out structure: remember shared brief, then per-target tasks.
    const shared = briefFor(llmPlan, "nova", goal);
    await ctx.kernel.memory.remember({
      scope: "run.working",
      content: shared,
      type: "ephemeral",
    });

    const many = await ctx.kernel.orchestration.delegateMany({
      targets: targets.map((target_agent) => ({
        target_agent,
        task: {
          from_memory: true,
          brief_scope: "run.working",
          goal: "(brief in run.working)",
          campaign_role: target_agent,
          specialist_brief: briefFor(llmPlan, target_agent, goal),
        },
      })),
    });

    // DR5 — all-or-nothing
    const failed = many.results.find((r) => r.status !== "completed");
    if (failed) {
      throw new Error(failed.error ?? "Campaign specialist failed");
    }

    // DR3 — deterministic aggregate keyed by target order
    const aggregate: Record<string, unknown> = {};
    for (let i = 0; i < targets.length; i++) {
      aggregate[targets[i]!] = many.results[i]?.result ?? null;
    }

    return {
      plan,
      result: aggregate,
      resolved_persona: resolved,
    };
  }

  if (llmPlan.mode === "single" && llmPlan.delegate_to !== "none") {
    const target = llmPlan.delegate_to;
    const brief = (llmPlan.brief?.trim() || goal).trim();
    await ctx.kernel.memory.remember({
      scope: "run.working",
      content: brief,
      type: "ephemeral",
    });
    const delegated = await ctx.kernel.orchestration.delegate({
      target_agent: target,
      task: {
        from_memory: true,
        brief_scope: "run.working",
        goal: "(brief in run.working)",
      },
    });

    if (delegated.status !== "completed") {
      throw new Error(delegated.error ?? `${target} delegation failed`);
    }

    return {
      plan,
      result: delegated.result,
      resolved_persona: resolved,
    };
  }

  // mode "none" — answer the user directly in chat (no specialist).
  const reply = await ctx.kernel.llm.complete({
    profile: "fast-cheap",
    messages: [
      {
        role: "system",
        content:
          "Tu es Adam, orchestrateur d'AT72 Verse. Réponds à l'utilisateur de façon claire et utile, dans sa langue. Sois concis. Si une tâche complexe est demandée, propose comment tu peux aider.",
      },
      { role: "user", content: goal },
    ],
  });

  return {
    plan,
    result: {
      content: reply.content?.trim() || llmPlan.summary || "C'est noté.",
    },
    resolved_persona: resolved,
  };
}

export const packageName = "@at72-verse/agent-adam" as const;
