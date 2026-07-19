/**
 * skill.support-triage — Phase 27c / DW2
 * Support ticket triage via LLM only (no dedicated tool).
 */
import type { KernelClient, SkillExecuteContext, SkillSpec } from "@at72-verse/contracts";
import { validateDataAgainstJsonSchema } from "@at72-verse/contracts";
import { KernelError } from "@at72-verse/verse-kernel";

export const SKILL_ID = "skill.support-triage" as const;

export const SUPPORT_TRIAGE_SKILL_SPEC: SkillSpec = {
  id: SKILL_ID,
  version: "0.1.0",
  name: "Support Triage",
  description: "Reusable support ticket triage via Kernel.llm only.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["brief"],
    properties: {
      brief: { type: "string", minLength: 1 },
      formality: { type: "string" },
      rules: { type: "string" },
    },
  },
  output_schema: {
    type: "object",
    additionalProperties: false,
    required: ["content", "category", "priority", "recommended_actions"],
    properties: {
      content: { type: "string", minLength: 1 },
      category: { type: "string" },
      priority: { type: "string" },
      recommended_actions: { type: "array", items: { type: "string" } },
    },
  },
  default_model_profile: "analytic-strict",
  persona_hints: { prefer_style: "structured" },
  tags: ["support", "triage"],
  eval_suite: "evals/support-triage-v0",
  permissions: ["skill.invoke:support-triage"],
};

export const skillSpec = SUPPORT_TRIAGE_SKILL_SPEC;

function requireValid(schema: Record<string, unknown>, data: unknown, label: string): void {
  const result = validateDataAgainstJsonSchema(schema, data);
  if (!result.ok) {
    throw new KernelError("INVALID_INPUT", `skill.support-triage ${label} schema validation failed`, {
      details: { errors: result.errors },
    });
  }
}

export async function execute(ctx: SkillExecuteContext): Promise<Record<string, unknown>> {
  requireValid(SUPPORT_TRIAGE_SKILL_SPEC.input_schema, ctx.input, "input");

  const brief = String(ctx.input.brief);
  const formality =
    typeof ctx.input.formality === "string" && ctx.input.formality.trim().length > 0
      ? ctx.input.formality.trim()
      : null;
  const rules =
    typeof ctx.input.rules === "string" && ctx.input.rules.trim().length > 0
      ? ctx.input.rules.trim()
      : null;

  const systemParts = [
    "You are a support triage specialist. Classify the ticket and propose next actions.",
    "Respond with clear category and priority cues in the text.",
  ];
  if (formality) systemParts.push(`Formality: ${formality}.`);
  if (rules) systemParts.push(`Rules:\n${rules}`);

  const completion = await ctx.kernel.llm.complete({
    profile: "analytic-strict",
    messages: [
      { role: "system", content: systemParts.join(" ") },
      { role: "user", content: `Brief:\n${brief}` },
    ],
    max_tokens: 800,
  });

  const content = completion.content.trim();
  const lower = `${brief} ${content}`.toLowerCase();
  const category = /billing|facture|paiement/.test(lower)
    ? "billing"
    : /bug|error|panne|outage/.test(lower)
      ? "technical"
      : /lead|achat|pricing|demo/.test(lower)
        ? "sales_handoff"
        : "general";
  const priority = /urgent|critique|bloquant|asap/.test(lower) ? "high" : "medium";

  const recommended_actions = content
    .split(/\n+/)
    .map((l) => l.replace(/^[-*•\d.]+\s*/, "").trim())
    .filter((l) => l.length > 8)
    .slice(0, 5);

  const output: Record<string, unknown> = {
    content,
    category,
    priority,
    recommended_actions:
      recommended_actions.length > 0
        ? recommended_actions
        : ["Acknowledge customer", "Gather logs", "Escalate if needed"],
  };

  requireValid(SUPPORT_TRIAGE_SKILL_SPEC.output_schema, output, "output");
  return output;
}

export async function executeWithKernel(
  kernel: KernelClient,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return execute({ kernel, input });
}

export const packageName = "@at72-verse/skill-support-triage" as const;
