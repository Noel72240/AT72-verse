/**
 * skill.watch-brief — Phase 27b / DV2 · DV5
 * Strategic watch brief via web-search (default on) + LLM.
 */
import type { KernelClient, SkillExecuteContext, SkillSpec } from "@at72-verse/contracts";
import { validateDataAgainstJsonSchema } from "@at72-verse/contracts";
import { KernelError } from "@at72-verse/verse-kernel";

export const SKILL_ID = "skill.watch-brief" as const;

export const WATCH_BRIEF_SKILL_SPEC: SkillSpec = {
  id: SKILL_ID,
  version: "0.1.0",
  name: "Watch Brief",
  description: "Reusable strategic watch / intelligence brief via web-search stub + LLM.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["brief"],
    properties: {
      brief: { type: "string", minLength: 1 },
      use_web_search: { type: "boolean" },
      search_query: { type: "string" },
      formality: { type: "string" },
      rules: { type: "string" },
    },
  },
  output_schema: {
    type: "object",
    additionalProperties: false,
    required: ["content", "signals", "next_actions"],
    properties: {
      content: { type: "string", minLength: 1 },
      signals: { type: "array", items: { type: "string" } },
      next_actions: { type: "array", items: { type: "string" } },
      sources: { type: "array", items: { type: "string" } },
    },
  },
  default_model_profile: "analytic-strict",
  persona_hints: { prefer_style: "structured" },
  tags: ["watch", "intelligence"],
  eval_suite: "evals/watch-brief-v0",
  permissions: ["skill.invoke:watch-brief"],
};

export const skillSpec = WATCH_BRIEF_SKILL_SPEC;

function requireValid(schema: Record<string, unknown>, data: unknown, label: string): void {
  const result = validateDataAgainstJsonSchema(schema, data);
  if (!result.ok) {
    throw new KernelError("INVALID_INPUT", `skill.watch-brief ${label} schema validation failed`, {
      details: { errors: result.errors },
    });
  }
}

export async function execute(ctx: SkillExecuteContext): Promise<Record<string, unknown>> {
  requireValid(WATCH_BRIEF_SKILL_SPEC.input_schema, ctx.input, "input");

  const brief = String(ctx.input.brief);
  // PO: web-search default ON for golden / demos (DV5)
  const useWebSearch = ctx.input.use_web_search !== false;
  const formality =
    typeof ctx.input.formality === "string" && ctx.input.formality.trim().length > 0
      ? ctx.input.formality.trim()
      : null;
  const rules =
    typeof ctx.input.rules === "string" && ctx.input.rules.trim().length > 0
      ? ctx.input.rules.trim()
      : null;

  const sources: string[] = [];
  let searchNotes = "";
  if (useWebSearch) {
    const query =
      typeof ctx.input.search_query === "string" && ctx.input.search_query.trim().length > 0
        ? ctx.input.search_query.trim()
        : `veille stratégique ${brief.slice(0, 100)}`;
    const search = await ctx.kernel.tools.execute({
      tool_id: "web-search",
      input: { query, limit: 3 },
    });
    const results = Array.isArray(search.output.results) ? search.output.results : [];
    for (const r of results) {
      if (r && typeof r === "object" && "url" in r) {
        sources.push(String((r as { url: unknown }).url));
      }
    }
    searchNotes = JSON.stringify(results);
  }

  const systemParts = [
    "You are a strategic watch analyst. Produce a concise intelligence brief with signals and next actions.",
  ];
  if (formality) systemParts.push(`Formality: ${formality}.`);
  if (rules) systemParts.push(`Rules:\n${rules}`);

  const completion = await ctx.kernel.llm.complete({
    profile: "analytic-strict",
    messages: [
      { role: "system", content: systemParts.join(" ") },
      {
        role: "user",
        content: [
          searchNotes ? `Search notes: ${searchNotes}` : "",
          `Brief:\n${brief}`,
        ]
          .filter(Boolean)
          .join("\n"),
      },
    ],
    max_tokens: 800,
  });

  const content = completion.content.trim();
  const lines = content
    .split(/\n+/)
    .map((l) => l.replace(/^[-*•\d.]+\s*/, "").trim())
    .filter((l) => l.length > 8);

  const output: Record<string, unknown> = {
    content,
    signals: lines.slice(0, 4).length > 0 ? lines.slice(0, 4) : ["Signal stub from watch brief"],
    next_actions:
      lines.slice(4, 7).length > 0
        ? lines.slice(4, 7)
        : ["Monitor competitors weekly", "Escalate material shifts to Orion"],
    ...(sources.length > 0 ? { sources } : {}),
  };

  requireValid(WATCH_BRIEF_SKILL_SPEC.output_schema, output, "output");
  return output;
}

export async function executeWithKernel(
  kernel: KernelClient,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return execute({ kernel, input });
}

export const packageName = "@at72-verse/skill-watch-brief" as const;
