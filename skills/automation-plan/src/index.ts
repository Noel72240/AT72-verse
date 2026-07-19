/**
 * skill.automation-plan — Phase 27b / DV2 · DV4
 * Produces an automation plan + dry-run http-request intent. Never executes actions.
 */
import type { KernelClient, SkillExecuteContext, SkillSpec } from "@at72-verse/contracts";
import { validateDataAgainstJsonSchema } from "@at72-verse/contracts";
import { KernelError } from "@at72-verse/verse-kernel";

export const SKILL_ID = "skill.automation-plan" as const;

export const AUTOMATION_PLAN_SKILL_SPEC: SkillSpec = {
  id: SKILL_ID,
  version: "0.1.0",
  name: "Automation Plan",
  description: "Plan automations via dry-run http-request + LLM. Never executes side-effects.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["brief"],
    properties: {
      brief: { type: "string", minLength: 1 },
      target_url: { type: "string" },
      method: { type: "string" },
      formality: { type: "string" },
      rules: { type: "string" },
    },
  },
  output_schema: {
    type: "object",
    additionalProperties: false,
    required: ["content", "steps", "dry_run", "executes"],
    properties: {
      content: { type: "string", minLength: 1 },
      steps: { type: "array", items: { type: "string" } },
      dry_run: { type: "object", additionalProperties: true },
      executes: { type: "boolean" },
    },
  },
  default_model_profile: "analytic-strict",
  persona_hints: { prefer_style: "structured" },
  tags: ["automation", "plan"],
  eval_suite: "evals/automation-plan-v0",
  permissions: ["skill.invoke:automation-plan"],
};

export const skillSpec = AUTOMATION_PLAN_SKILL_SPEC;

function requireValid(schema: Record<string, unknown>, data: unknown, label: string): void {
  const result = validateDataAgainstJsonSchema(schema, data);
  if (!result.ok) {
    throw new KernelError("INVALID_INPUT", `skill.automation-plan ${label} schema validation failed`, {
      details: { errors: result.errors },
    });
  }
}

export async function execute(ctx: SkillExecuteContext): Promise<Record<string, unknown>> {
  requireValid(AUTOMATION_PLAN_SKILL_SPEC.input_schema, ctx.input, "input");

  const brief = String(ctx.input.brief);
  const targetUrl =
    typeof ctx.input.target_url === "string" && ctx.input.target_url.trim().length > 0
      ? ctx.input.target_url.trim()
      : "https://example.com/hooks/verse-automation";
  const method =
    typeof ctx.input.method === "string" && ctx.input.method.trim().length > 0
      ? ctx.input.method.trim().toUpperCase()
      : "POST";
  const formality =
    typeof ctx.input.formality === "string" && ctx.input.formality.trim().length > 0
      ? ctx.input.formality.trim()
      : null;
  const rules =
    typeof ctx.input.rules === "string" && ctx.input.rules.trim().length > 0
      ? ctx.input.rules.trim()
      : null;

  const dryRun = await ctx.kernel.tools.execute({
    tool_id: "http-request",
    input: {
      method,
      url: targetUrl,
      body: JSON.stringify({ brief: brief.slice(0, 200), source: "skill.automation-plan" }),
    },
  });

  const systemParts = [
    "You are an automation planner. Produce a step plan and recommendations only.",
    "Never claim that an HTTP request or automation was executed — dry-run intents only.",
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
          `Dry-run intent: ${JSON.stringify(dryRun.output)}`,
          `Brief:\n${brief}`,
        ].join("\n"),
      },
    ],
    max_tokens: 800,
  });

  const content = completion.content.trim();
  const steps = content
    .split(/\n+/)
    .map((l) => l.replace(/^[-*•\d.]+\s*/, "").trim())
    .filter((l) => l.length > 8)
    .slice(0, 8);

  const output: Record<string, unknown> = {
    content,
    steps:
      steps.length > 0
        ? steps
        : [
            "Validate webhook payload schema",
            "Dry-run HTTP intent to target URL",
            "Review plan with human before live enablement (Phase 28+)",
          ],
    dry_run: dryRun.output,
    executes: false,
  };

  requireValid(AUTOMATION_PLAN_SKILL_SPEC.output_schema, output, "output");
  return output;
}

export async function executeWithKernel(
  kernel: KernelClient,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return execute({ kernel, input });
}

export const packageName = "@at72-verse/skill-automation-plan" as const;
