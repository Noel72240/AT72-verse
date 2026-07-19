/**
 * skill.writing — hybrid SkillSpec + execute (Phase 14 · 17 · 19).
 * Independent of any agent — reusable via Kernel.skills.invoke only.
 * web-search is used ONLY when input.use_web_search === true (DM11).
 */
import type { KernelClient, SkillExecuteContext, SkillSpec } from "@at72-verse/contracts";
import { validateDataAgainstJsonSchema } from "@at72-verse/contracts";
import { KernelError } from "@at72-verse/verse-kernel";

export const SKILL_ID = "skill.writing" as const;

export const WRITING_SKILL_SPEC: SkillSpec = {
  id: SKILL_ID,
  version: "0.1.1",
  name: "Writing",
  description:
    "Reusable writing skill via Kernel.llm; optional explicit Kernel.tools web-search citation.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["brief"],
    properties: {
      brief: { type: "string", minLength: 1 },
      format: { type: "string" },
      tone: { type: "string" },
      formality: { type: "string" },
      rules: { type: "string" },
      /** Explicit opt-in — never implied (Phase 19 / DM11). */
      use_web_search: { type: "boolean" },
      search_query: { type: "string" },
    },
  },
  output_schema: {
    type: "object",
    additionalProperties: false,
    required: ["content"],
    properties: {
      content: { type: "string", minLength: 1 },
      title: { type: "string" },
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
  default_model_profile: "creative-balanced",
  persona_hints: { prefer_style: "structured" },
  tags: ["content", "copy"],
  eval_suite: "evals/writing-v0",
  permissions: ["skill.invoke:writing"],
};

/** Marketplace / registry alias for SkillSpec. */
export const skillSpec = WRITING_SKILL_SPEC;

function requireValid(schema: Record<string, unknown>, data: unknown, label: string): void {
  const result = validateDataAgainstJsonSchema(schema, data);
  if (!result.ok) {
    throw new KernelError("INVALID_INPUT", `skill.writing ${label} schema validation failed`, {
      details: { errors: result.errors },
    });
  }
}

/**
 * Execute writing skill (BC1). Chooses Model Profile only — never a raw model id (BF1).
 */
export async function execute(ctx: SkillExecuteContext): Promise<Record<string, unknown>> {
  requireValid(WRITING_SKILL_SPEC.input_schema, ctx.input, "input");

  const brief = String(ctx.input.brief);
  const format = typeof ctx.input.format === "string" ? ctx.input.format : "prose";
  const tone = typeof ctx.input.tone === "string" ? ctx.input.tone : "clear";
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
    "You are a professional writing assistant. Return usable copy only. Prefer a short title then the body.",
  ];
  if (formality) {
    systemParts.push(`Formality (address the reader accordingly): ${formality}.`);
  }
  if (rules) {
    systemParts.push(`Rules to follow:\n${rules}`);
  }
  if (sources.length > 0) {
    systemParts.push(
      "Cite the provided sources when relevant; do not invent URLs.",
    );
  }

  const userParts = [`Format: ${format}`, `Tone: ${tone}`];
  if (formality) {
    userParts.push(`Formality: ${formality}`);
  }
  if (rules) {
    userParts.push(`Rules:\n${rules}`);
  }
  if (sources.length > 0) {
    userParts.push(
      `Sources:\n${sources.map((s, i) => `${i + 1}. ${s.title} — ${s.url}`).join("\n")}`,
    );
  }
  userParts.push(`Brief:\n${brief}`);

  const completion = await ctx.kernel.llm.complete({
    profile: "creative-balanced",
    messages: [
      {
        role: "system",
        content: systemParts.join(" "),
      },
      {
        role: "user",
        content: userParts.join("\n"),
      },
    ],
    max_tokens: 800,
  });

  const content = completion.content.trim();
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const output: Record<string, unknown> = {
    content,
    ...(titleMatch ? { title: titleMatch[1]!.trim() } : {}),
    ...(sources.length > 0 ? { sources } : {}),
  };

  requireValid(WRITING_SKILL_SPEC.output_schema, output, "output");
  return output;
}

export async function executeWithKernel(
  kernel: KernelClient,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return execute({ kernel, input });
}

export const packageName = "@at72-verse/skill-writing" as const;
