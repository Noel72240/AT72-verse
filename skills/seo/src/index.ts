/**
 * skill.seo — Phase 23 / DQ4
 * Uses seo-audit tool + optional web-search; LLM synthesizes recommendations.
 */
import type { KernelClient, SkillExecuteContext, SkillSpec } from "@at72-verse/contracts";
import { validateDataAgainstJsonSchema } from "@at72-verse/contracts";
import { KernelError } from "@at72-verse/verse-kernel";

export const SKILL_ID = "skill.seo" as const;

export const SEO_SKILL_SPEC: SkillSpec = {
  id: SKILL_ID,
  version: "0.1.0",
  name: "SEO",
  description: "Reusable SEO skill via Kernel.tools seo-audit + Kernel.llm.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["brief"],
    properties: {
      brief: { type: "string", minLength: 1 },
      url: { type: "string" },
      formality: { type: "string" },
      rules: { type: "string" },
      use_web_search: { type: "boolean" },
      search_query: { type: "string" },
    },
  },
  output_schema: {
    type: "object",
    additionalProperties: false,
    required: ["content", "score", "recommendations"],
    properties: {
      content: { type: "string", minLength: 1 },
      score: { type: "number" },
      recommendations: { type: "array", items: { type: "string" } },
      findings: { type: "array", items: { type: "string" } },
    },
  },
  default_model_profile: "analytic-strict",
  persona_hints: { prefer_style: "structured" },
  tags: ["seo", "audit"],
  eval_suite: "evals/seo-v0",
  permissions: ["skill.invoke:seo"],
};

export const skillSpec = SEO_SKILL_SPEC;

function requireValid(schema: Record<string, unknown>, data: unknown, label: string): void {
  const result = validateDataAgainstJsonSchema(schema, data);
  if (!result.ok) {
    throw new KernelError("INVALID_INPUT", `skill.seo ${label} schema validation failed`, {
      details: { errors: result.errors },
    });
  }
}

export async function execute(ctx: SkillExecuteContext): Promise<Record<string, unknown>> {
  requireValid(SEO_SKILL_SPEC.input_schema, ctx.input, "input");

  const brief = String(ctx.input.brief);
  const url =
    typeof ctx.input.url === "string" && ctx.input.url.trim().length > 0
      ? ctx.input.url.trim()
      : "https://example.com/";
  const formality =
    typeof ctx.input.formality === "string" && ctx.input.formality.trim().length > 0
      ? ctx.input.formality.trim()
      : null;
  const rules =
    typeof ctx.input.rules === "string" && ctx.input.rules.trim().length > 0
      ? ctx.input.rules.trim()
      : null;

  const audit = await ctx.kernel.tools.execute({
    tool_id: "seo-audit",
    input: { url, focus: brief.slice(0, 120) },
  });
  const score = typeof audit.output.score === "number" ? audit.output.score : 0;
  const findings = Array.isArray(audit.output.findings)
    ? audit.output.findings.map((f) => String(f))
    : [];

  let searchNotes = "";
  if (ctx.input.use_web_search === true) {
    const query =
      typeof ctx.input.search_query === "string" && ctx.input.search_query.trim().length > 0
        ? ctx.input.search_query.trim()
        : `SEO ${brief.slice(0, 100)}`;
    const search = await ctx.kernel.tools.execute({
      tool_id: "web-search",
      input: { query, limit: 2 },
    });
    searchNotes = JSON.stringify(search.output.results ?? []);
  }

  const systemParts = [
    "You are an SEO specialist. Turn audit findings into concise actionable recommendations.",
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
          `URL: ${url}`,
          `Score: ${score}`,
          `Findings:\n${findings.join("\n")}`,
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
  const recommendations = content
    .split(/\n+/)
    .map((l) => l.replace(/^[-*•\d.]+\s*/, "").trim())
    .filter((l) => l.length > 8)
    .slice(0, 6);

  const output: Record<string, unknown> = {
    content,
    score,
    findings,
    recommendations:
      recommendations.length > 0 ? recommendations : ["Review title tags and internal linking."],
  };

  requireValid(SEO_SKILL_SPEC.output_schema, output, "output");
  return output;
}

export async function executeWithKernel(
  kernel: KernelClient,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return execute({ kernel, input });
}

export const packageName = "@at72-verse/skill-seo" as const;
