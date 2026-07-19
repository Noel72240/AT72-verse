/**
 * skill.analysis — Phase 23 / DQ4
 * Independent of any agent — reusable via Kernel.skills.invoke only.
 */
import type { KernelClient, SkillExecuteContext, SkillSpec } from "@at72-verse/contracts";
import { validateDataAgainstJsonSchema } from "@at72-verse/contracts";
import { KernelError } from "@at72-verse/verse-kernel";

export const SKILL_ID = "skill.analysis" as const;

export const ANALYSIS_SKILL_SPEC: SkillSpec = {
  id: SKILL_ID,
  version: "0.1.0",
  name: "Analysis",
  description: "Reusable analysis skill via Kernel.llm; optional explicit web-search.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["brief"],
    properties: {
      brief: { type: "string", minLength: 1 },
      focus: { type: "string" },
      formality: { type: "string" },
      rules: { type: "string" },
      use_web_search: { type: "boolean" },
      search_query: { type: "string" },
    },
  },
  output_schema: {
    type: "object",
    additionalProperties: false,
    required: ["content", "insights"],
    properties: {
      content: { type: "string", minLength: 1 },
      insights: { type: "array", items: { type: "string" } },
      sources: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "url"],
          properties: {
            title: { type: "string" },
            url: { type: "string" },
            snippet: { type: "string" },
          },
        },
      },
    },
  },
  default_model_profile: "analytic-strict",
  persona_hints: { prefer_style: "structured" },
  tags: ["analysis", "insights"],
  eval_suite: "evals/analysis-v0",
  permissions: ["skill.invoke:analysis"],
};

export const skillSpec = ANALYSIS_SKILL_SPEC;

function requireValid(schema: Record<string, unknown>, data: unknown, label: string): void {
  const result = validateDataAgainstJsonSchema(schema, data);
  if (!result.ok) {
    throw new KernelError("INVALID_INPUT", `skill.analysis ${label} schema validation failed`, {
      details: { errors: result.errors },
    });
  }
}

export async function execute(ctx: SkillExecuteContext): Promise<Record<string, unknown>> {
  requireValid(ANALYSIS_SKILL_SPEC.input_schema, ctx.input, "input");

  const brief = String(ctx.input.brief);
  const focus = typeof ctx.input.focus === "string" ? ctx.input.focus : "general";
  const formality =
    typeof ctx.input.formality === "string" && ctx.input.formality.trim().length > 0
      ? ctx.input.formality.trim()
      : null;
  const rules =
    typeof ctx.input.rules === "string" && ctx.input.rules.trim().length > 0
      ? ctx.input.rules.trim()
      : null;
  const useWebSearch = ctx.input.use_web_search === true;

  let sources: Array<{ title: string; url: string; snippet?: string }> = [];
  if (useWebSearch) {
    const query =
      typeof ctx.input.search_query === "string" && ctx.input.search_query.trim().length > 0
        ? ctx.input.search_query.trim()
        : brief.slice(0, 200);
    const toolResult = await ctx.kernel.tools.execute({
      tool_id: "web-search",
      input: { query, limit: 3 },
    });
    const raw = toolResult.output.results;
    if (Array.isArray(raw)) {
      sources = raw
        .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
        .map((r) => ({
          title: String(r.title ?? ""),
          url: String(r.url ?? ""),
          ...(typeof r.snippet === "string" ? { snippet: r.snippet } : {}),
        }))
        .filter((r) => r.title && r.url);
    }
  }

  const systemParts = [
    "You are a rigorous analyst. Return clear insights and a short structured analysis. Do not invent metrics.",
  ];
  if (formality) systemParts.push(`Formality: ${formality}.`);
  if (rules) systemParts.push(`Rules:\n${rules}`);

  const userParts = [`Focus: ${focus}`, `Brief:\n${brief}`];
  if (sources.length > 0) {
    userParts.push(
      `Sources:\n${sources.map((s, i) => `${i + 1}. ${s.title} — ${s.url}`).join("\n")}`,
    );
  }

  const completion = await ctx.kernel.llm.complete({
    profile: "analytic-strict",
    messages: [
      { role: "system", content: systemParts.join(" ") },
      { role: "user", content: userParts.join("\n") },
    ],
    max_tokens: 900,
  });

  const content = completion.content.trim();
  const insights = content
    .split(/\n+/)
    .map((l) => l.replace(/^[-*•\d.]+\s*/, "").trim())
    .filter((l) => l.length > 12)
    .slice(0, 5);
  const output: Record<string, unknown> = {
    content,
    insights: insights.length > 0 ? insights : ["Analysis completed (see content)."],
    ...(sources.length > 0 ? { sources } : {}),
  };

  requireValid(ANALYSIS_SKILL_SPEC.output_schema, output, "output");
  return output;
}

export async function executeWithKernel(
  kernel: KernelClient,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return execute({ kernel, input });
}

export const packageName = "@at72-verse/skill-analysis" as const;
