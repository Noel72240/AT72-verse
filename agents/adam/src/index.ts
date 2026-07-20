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
- Greetings, small talk, questions, help requests with no deliverable → mode "none" (NEVER campaign)
- Full content campaign (article + SEO + visual) → mode "campaign" with targets nova,astra,pixel
- Content / LinkedIn / post / article / writing only → mode "single", delegate_to "nova"
- Analysis / data / insights → mode "single", delegate_to "orion"
- SEO / audit / ranking alone → mode "single", delegate_to "astra"
- Image / visual / design alone → mode "single", delegate_to "pixel"
- Otherwise mode "none"
- Choose at most one mode. Never invent other agents. Never use campaign for a greeting like "salut" or "hello".`;

/** User wants to publish (or simulate publishing) a drafted post. */
export function isPublishIntent(goal: string): boolean {
  const g = goal.trim().toLowerCase();
  if (!g) return false;
  if (/\b(publie|publish|poste[rz]?|envoie|envoyer)\b/.test(g)) return true;
  if (/^go\s*(live|linkedin)?[\s!?.]*$/i.test(g)) return true;
  return false;
}

/** Opt-in real LinkedIn publish (default remains dry-run simulation). */
export function isLivePublishIntent(goal: string): boolean {
  const g = goal.trim().toLowerCase();
  return (
    /\b(en\s+live|en\s+vrai|for\s+real|really|maintenant|now)\b/.test(g) ||
    /\bpublie\s+(vraiment|réellement|reellement)\b/.test(g) ||
    /\blive\s+publish\b/.test(g)
  );
}

const DRAFT_MARKER = "---DRAFT---";

/** Pull post body from chat-attached draft or leftover text after the publish verb. */
export function extractPublishDraft(goal: string): string | null {
  const markerIdx = goal.indexOf(DRAFT_MARKER);
  if (markerIdx >= 0) {
    const body = goal
      .slice(markerIdx + DRAFT_MARKER.length)
      .replace(/^\s*\n?/, "")
      .trim();
    return body.length > 0 ? stripPublishCta(body) : null;
  }
  const stripped = goal
    .replace(
      /^(publie|publish|poste[rz]?|envoie|envoyer)(\s+(ça|ca|le|ce|ceci|this|sur\s+linkedin|en\s+live|en\s+vrai|maintenant|for\s+real|really|now))*[\s:!.-]*/i,
      "",
    )
    .trim();
  if (stripped.length >= 40) return stripPublishCta(stripped);
  return null;
}

function stripPublishCta(text: string): string {
  return text
    .replace(/\n*---\nPour publier sur LinkedIn[\s\S]*$/i, "")
    .trim();
}

function isDirectChatGoal(goal: string): boolean {
  if (isPublishIntent(goal)) return false;
  const g = goal.trim().toLowerCase();
  if (g.length <= 40) {
    if (
      /^(salut|bonjour|bonsoir|hello|hi|hey|coucou|yo|slt|wesh|ça va|ca va|merci|thanks|ok|allor|alors|ah|test)[\s!?.]*$/i.test(
        g,
      )
    ) {
      return true;
    }
  }
  // Short messages without a clear specialist deliverable → chat, not campaign.
  if (
    g.length <= 24 &&
    !/(post|poste|linkedin|article|seo|image|campagne|campaign|rédige|redige|write|analyse)/i.test(g)
  ) {
    return true;
  }
  return false;
}

function isSimpleWritingGoal(goal: string): boolean {
  if (isPublishIntent(goal)) return false;
  const g = goal.trim().toLowerCase();
  if (/campagne|campaign|(article|contenu).*(seo|visuel|image)/.test(g)) {
    return false;
  }
  return /facebook|linkedin|instagram|twitter|x\.com|post|poste|rédige|redige|write|annonce/.test(
    g,
  );
}

const PUBLISH_CTA =
  "\n\n---\nPour publier : dis « publie » (simulation) ou « publie en live » (Facebook / Instagram / LinkedIn après /connectors). Instagram live = caption + URL image https://…jpg/png.";

function detectPublishPlatform(goal: string): "linkedin" | "facebook" | "instagram" {
  const g = goal.toLowerCase();
  if (/\binstagram\b|\binsta\b/.test(g)) return "instagram";
  if (/\bfacebook\b|\bfb\b/.test(g)) return "facebook";
  return "linkedin";
}

function extractImageUrl(text: string): string | null {
  const m = text.match(/https:\/\/[^\s<>"']+\.(?:jpg|jpeg|png|webp)(?:\?[^\s<>"']*)?/i);
  return m?.[0] ?? null;
}

/** True when the "draft" is still a writing instruction, not post body. */
export function looksLikePublishInstruction(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  if (/\bpuis\s+publie\b/.test(t)) return true;
  return (
    /\b(rédige|redige|écris|ecris|write|prépare|prepare)\b/.test(t) &&
    /\b(publie|publish|poste[rz]?)\b/.test(t)
  );
}

async function directWriteReply(
  ctx: AdamHandleTaskContext,
  goal: string,
  resolved: ResolvedPersona,
): Promise<AdamHandleTaskResult> {
  const plan: AgentPlan = {
    version: "1",
    steps: [{ name: "direct_write", kind: "act", agent_id: ADAM_AGENT_ID }],
  };
  const reply = await ctx.kernel.llm.complete({
    profile: "fast-cheap",
    messages: [
      {
        role: "system",
        content:
          "Tu es un copywriter social media. Écris uniquement le contenu demandé, prêt à publier (emojis/hashtags OK). Pas d'intro du type « Voici un post ». Sois concis.",
      },
      { role: "user", content: goal },
    ],
  });
  const body = reply.content?.trim() || "Je n'ai pas pu rédiger le post — réessaie.";
  return {
    plan,
    result: {
      content: `${body}${PUBLISH_CTA}`,
    },
    resolved_persona: resolved,
  };
}

function formatPulsePublishResult(
  mode: "dry_run" | "live",
  draft: string,
  platform: "linkedin" | "facebook" | "instagram",
  pulseResult: Record<string, unknown> | undefined,
): string {
  const fromPulse =
    typeof pulseResult?.content === "string" && pulseResult.content.trim()
      ? pulseResult.content.trim()
      : null;
  if (fromPulse) return fromPulse;

  const label =
    platform === "linkedin" ? "LinkedIn" : platform === "facebook" ? "Facebook" : "Instagram";

  if (mode === "live") {
    const pub = pulseResult?.publish_result as Record<string, unknown> | undefined;
    const id = typeof pub?.external_post_id === "string" ? pub.external_post_id : null;
    return [`✅ Publié sur ${label}.`, id ? `ID : ${id}` : null, "", draft]
      .filter((line) => line !== null)
      .join("\n");
  }

  return [
    `✅ Simulation ${label} (dry-run) — rien n'a été publié pour de vrai.`,
    "",
    draft,
    "",
    `Ensuite : connecte ${label} sur /connectors, puis dis « publie en live ».`,
  ].join("\n");
}

async function publishViaPulse(
  ctx: AdamHandleTaskContext,
  goal: string,
  resolved: ResolvedPersona,
): Promise<AdamHandleTaskResult> {
  const plan: AgentPlan = {
    version: "1",
    steps: [
      { name: "prepare_publish", kind: "reason", agent_id: ADAM_AGENT_ID },
      { name: "delegate_pulse", kind: "delegate", agent_id: "pulse" },
      { name: "report_publish", kind: "act", agent_id: ADAM_AGENT_ID },
    ],
  };

  const platform = detectPublishPlatform(goal);
  const platformLabel =
    platform === "linkedin" ? "LinkedIn" : platform === "facebook" ? "Facebook" : "Instagram";

  let draft = extractPublishDraft(goal);
  if (!draft || looksLikePublishInstruction(goal) || looksLikePublishInstruction(draft)) {
    // "Rédige … puis publie en live" → write a real post body first, then publish it.
    if (looksLikePublishInstruction(goal) || (draft && looksLikePublishInstruction(draft))) {
      const written = await ctx.kernel.llm.complete({
        profile: "fast-cheap",
        messages: [
          {
            role: "system",
            content:
              "Tu es un copywriter social media. Écris uniquement le post demandé, prêt à publier (emojis/hashtags OK). Pas d'intro du type « Voici un post ». Sois concis.",
          },
          { role: "user", content: goal },
        ],
      });
      draft = written.content?.trim() || null;
    }
  }
  if (!draft) {
    return {
      plan: {
        version: "1",
        steps: [{ name: "publish_need_draft", kind: "act", agent_id: ADAM_AGENT_ID }],
      },
      result: {
        content: `Je n'ai pas de brouillon à publier. Demande-moi d'abord un post ${platformLabel}, puis réponds simplement « publie ».`,
      },
      resolved_persona: resolved,
    };
  }

  const mode: "dry_run" | "live" = isLivePublishIntent(goal) ? "live" : "dry_run";
  const imageUrl = extractImageUrl(goal) ?? extractImageUrl(draft);

  if (mode === "live" && platform === "instagram" && !imageUrl && !process.env.VERSE_IG_DEFAULT_IMAGE_URL) {
    return {
      plan: {
        version: "1",
        steps: [{ name: "publish_need_image", kind: "act", agent_id: ADAM_AGENT_ID }],
      },
      result: {
        content:
          "Instagram exige une image publique (URL https://…jpg/png). Colle une URL d'image dans le message, ou configure VERSE_IG_DEFAULT_IMAGE_URL sur Railway, puis réessaie « publie en live ».",
      },
      resolved_persona: resolved,
    };
  }

  await ctx.kernel.memory.remember({
    scope: "run.working",
    content: draft,
    type: "ephemeral",
  });

  try {
    const delegated = await ctx.kernel.orchestration.delegate({
      target_agent: "pulse",
      task: {
        from_memory: true,
        brief_scope: "run.working",
        goal: draft,
        mode,
        platform,
        publish_as_is: true,
        ...(imageUrl ? { image_url: imageUrl } : {}),
      },
    });

    if (delegated.status !== "completed") {
      const err = delegated.error ?? "Publication échouée";
      if (err.includes("WAITING_APPROVAL")) {
        return {
          plan,
          result: {
            content:
              "La publication attend une approbation humaine. Ouvre /approvals pour valider ou refuser.",
          },
          resolved_persona: resolved,
        };
      }
      if (/CONNECTOR_NOT_CONNECTED|not connected|OAuth/i.test(err)) {
        return {
          plan,
          result: {
            content: `${platformLabel} n'est pas connecté pour ce workspace. Va sur /connectors, connecte ${platformLabel}, puis réessaie « publie en live ».`,
          },
          resolved_persona: resolved,
        };
      }
      if (/META_PAGE_REQUIRED|No Facebook Page selected/i.test(err)) {
        return {
          plan,
          result: {
            content:
              "Aucune Page Facebook sélectionnée. Va sur /connectors, choisis AlloTech72, puis réessaie « publie en live ».",
          },
          resolved_persona: resolved,
        };
      }
      if (/IG_MEDIA_REQUIRED|image URL|VERSE_IG_DEFAULT/i.test(err)) {
        return {
          plan,
          result: {
            content:
              "Instagram exige une image publique (URL https://…jpg/png). Colle l'URL dans le message avec « publie en live », ou configure VERSE_IG_DEFAULT_IMAGE_URL.",
          },
          resolved_persona: resolved,
        };
      }
      if (/IG_USER_REQUIRED|Instagram Business/i.test(err)) {
        return {
          plan,
          result: {
            content:
              "Aucun compte Instagram Pro lié à la Page. Sur /connectors, choisis AlloTech72 (avec IG lié), puis réessaie.",
          },
          resolved_persona: resolved,
        };
      }
      if (/LIVE_PUBLISH_PLATFORM_PENDING|not available yet|NOT_IMPLEMENTED/i.test(err)) {
        return {
          plan,
          result: {
            content: `${platformLabel} est connectable, mais la publication live arrive bientôt. Tu peux utiliser « publie » (simulation) ou Facebook pour le live.`,
          },
          resolved_persona: resolved,
        };
      }
      if (/PROVIDER_ERROR|Facebook Page feed|Instagram media|feed publish failed/i.test(err)) {
        return {
          plan,
          result: {
            content: `Meta a refusé la publication : ${err}. Vérifie les permissions / l'URL d'image, puis reconnecte sur /connectors si besoin.`,
          },
          resolved_persona: resolved,
        };
      }
      return {
        plan,
        result: {
          content: `Publication impossible : ${err}`,
        },
        resolved_persona: resolved,
      };
    }

    const pulseResult =
      delegated.result && typeof delegated.result === "object"
        ? (delegated.result as Record<string, unknown>)
        : undefined;

    return {
      plan,
      result: {
        ...(pulseResult ?? {}),
        content: formatPulsePublishResult(mode, draft, platform, pulseResult),
        mode,
        platform,
      },
      resolved_persona: resolved,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/CONNECTOR_NOT_CONNECTED|not connected|OAuth/i.test(msg)) {
      return {
        plan,
        result: {
          content: `${platformLabel} n'est pas connecté pour ce workspace. Va sur /connectors, connecte ${platformLabel}, puis réessaie « publie en live ».`,
        },
        resolved_persona: resolved,
      };
    }
    if (/WAITING_APPROVAL/i.test(msg)) {
      return {
        plan,
        result: {
          content:
            "La publication attend une approbation humaine. Ouvre /approvals pour valider ou refuser.",
        },
        resolved_persona: resolved,
      };
    }
    if (/META_PAGE_REQUIRED|No Facebook Page selected/i.test(msg)) {
      return {
        plan,
        result: {
          content:
            "Aucune Page Facebook sélectionnée. Va sur /connectors, choisis AlloTech72, puis réessaie « publie en live ».",
        },
        resolved_persona: resolved,
      };
    }
    if (/LIVE_PUBLISH_PLATFORM_PENDING|not available yet|NOT_IMPLEMENTED/i.test(msg)) {
      return {
        plan,
        result: {
          content: `${platformLabel} est connectable, mais la publication live arrive bientôt. Tu peux utiliser « publie » (simulation) ou LinkedIn pour le live.`,
        },
        resolved_persona: resolved,
      };
    }
    return {
      plan,
      result: {
        content: `Publication impossible : ${msg}`,
      },
      resolved_persona: resolved,
    };
  }
}

async function directChatReply(
  ctx: AdamHandleTaskContext,
  goal: string,
  resolved: ResolvedPersona,
): Promise<AdamHandleTaskResult> {
  const plan: AgentPlan = {
    version: "1",
    steps: [{ name: "direct_reply", kind: "act", agent_id: ADAM_AGENT_ID }],
  };
  const reply = await ctx.kernel.llm.complete({
    profile: "fast-cheap",
    messages: [
      {
        role: "system",
        content:
          "Tu es Adam, orchestrateur d'AT72 Verse. Réponds à l'utilisateur de façon claire et utile, dans sa langue. Sois concis et amical.",
      },
      { role: "user", content: goal },
    ],
  });
  return {
    plan,
    result: {
      content: reply.content?.trim() || "Salut ! Comment puis-je t'aider ?",
    },
    resolved_persona: resolved,
  };
}

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
  if (/linkedin|facebook|instagram|rédige|redige|write|post|poste|article|blog|content|contenu|annonce|réseau|reseau|social/.test(g)) {
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

function extractTextFromUnknown(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (!value || typeof value !== "object") return null;
  const obj = value as Record<string, unknown>;
  for (const key of ["content", "text", "message", "reply", "output"] as const) {
    const v = obj[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  for (const nested of Object.values(obj)) {
    const found = extractTextFromUnknown(nested);
    if (found) return found;
  }
  return null;
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

  // Publish / schedule intent → Pulse (LinkedIn dry-run by default, live opt-in).
  if (isPublishIntent(goal)) {
    return publishViaPulse(ctx, goal, resolved);
  }

  // Chat / greetings must never fan-out to a campaign (LLM planner is over-eager).
  if (isDirectChatGoal(goal)) {
    return directChatReply(ctx, goal, resolved);
  }

  // Simple social/post asks: one fast LLM call (skip Nova + skill hop).
  if (isSimpleWritingGoal(goal)) {
    return directWriteReply(ctx, goal, resolved);
  }

  // Skip planner LLM when the goal clearly maps to a specialist (faster posts / SEO / etc.).
  let llmPlan = heuristicPlan(goal);
  if (llmPlan.mode === "none") {
    const completion = await ctx.kernel.llm.complete({
      profile: "fast-cheap",
      messages: [
        { role: "system", content: ADAM_PLANNER_SYSTEM },
        { role: "user", content: goal },
      ],
    });
    llmPlan = parseAdamLlmPlan(completion.content, goal);
  }
  // Safety net: never campaign on tiny goals even if the planner misfires.
  if (llmPlan.mode === "campaign" && goal.trim().length < 48) {
    llmPlan = { mode: "none", delegate_to: "none", summary: "Prefer direct reply for short goal" };
  }
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

    // DR3 — deterministic aggregate keyed by target order + chat-readable content
    const aggregate: Record<string, unknown> = {};
    const parts: string[] = [];
    for (let i = 0; i < targets.length; i++) {
      const target = targets[i]!;
      const specialistResult = many.results[i]?.result ?? null;
      aggregate[target] = specialistResult;
      const text = extractTextFromUnknown(specialistResult);
      if (text) parts.push(`### ${target}\n${text}`);
    }

    return {
      plan,
      result: {
        ...aggregate,
        content:
          parts.join("\n\n").trim() ||
          llmPlan.summary ||
          "Campagne terminée (pas de contenu textuel retourné).",
      },
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
