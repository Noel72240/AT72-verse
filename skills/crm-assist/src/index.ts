/**
 * skill.crm-assist — Phase 27c / DW2
 * CRM assist via dry-run crm-sync + LLM. Never syncs live.
 */
import type { KernelClient, SkillExecuteContext, SkillSpec } from "@at72-verse/contracts";
import { validateDataAgainstJsonSchema } from "@at72-verse/contracts";
import { KernelError } from "@at72-verse/verse-kernel";

export const SKILL_ID = "skill.crm-assist" as const;

export const CRM_ASSIST_SKILL_SPEC: SkillSpec = {
  id: SKILL_ID,
  version: "0.1.0",
  name: "CRM Assist",
  description: "Reusable CRM assist / pipeline skill via dry-run crm-sync + LLM.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["brief"],
    properties: {
      brief: { type: "string", minLength: 1 },
      object_type: { type: "string" },
      operation: { type: "string" },
      formality: { type: "string" },
      rules: { type: "string" },
    },
  },
  output_schema: {
    type: "object",
    additionalProperties: false,
    required: ["content", "actions", "dry_run"],
    properties: {
      content: { type: "string", minLength: 1 },
      actions: { type: "array", items: { type: "string" } },
      dry_run: { type: "object", additionalProperties: true },
    },
  },
  default_model_profile: "analytic-strict",
  persona_hints: { prefer_style: "structured" },
  tags: ["crm", "sales"],
  eval_suite: "evals/crm-assist-v0",
  permissions: ["skill.invoke:crm-assist"],
};

export const skillSpec = CRM_ASSIST_SKILL_SPEC;

function requireValid(schema: Record<string, unknown>, data: unknown, label: string): void {
  const result = validateDataAgainstJsonSchema(schema, data);
  if (!result.ok) {
    throw new KernelError("INVALID_INPUT", `skill.crm-assist ${label} schema validation failed`, {
      details: { errors: result.errors },
    });
  }
}

export async function execute(ctx: SkillExecuteContext): Promise<Record<string, unknown>> {
  requireValid(CRM_ASSIST_SKILL_SPEC.input_schema, ctx.input, "input");

  const brief = String(ctx.input.brief);
  const object_type =
    typeof ctx.input.object_type === "string" && ctx.input.object_type.trim().length > 0
      ? ctx.input.object_type.trim()
      : "lead";
  const operation =
    typeof ctx.input.operation === "string" && ctx.input.operation.trim().length > 0
      ? ctx.input.operation.trim()
      : "upsert";
  const formality =
    typeof ctx.input.formality === "string" && ctx.input.formality.trim().length > 0
      ? ctx.input.formality.trim()
      : null;
  const rules =
    typeof ctx.input.rules === "string" && ctx.input.rules.trim().length > 0
      ? ctx.input.rules.trim()
      : null;

  const dryRun = await ctx.kernel.tools.execute({
    tool_id: "crm-sync",
    input: {
      object_type,
      operation,
      record: { summary: brief.slice(0, 120), source: "skill.crm-assist" },
    },
  });

  const systemParts = [
    "You are a commercial CRM assistant. Propose pipeline actions from the brief and dry-run CRM intent.",
    "Never claim a CRM sync was executed live.",
  ];
  if (formality) systemParts.push(`Formality: ${formality}.`);
  if (rules) systemParts.push(`Rules:\n${rules}`);

  const completion = await ctx.kernel.llm.complete({
    profile: "analytic-strict",
    messages: [
      { role: "system", content: systemParts.join(" ") },
      {
        role: "user",
        content: [`Dry-run intent: ${JSON.stringify(dryRun.output)}`, `Brief:\n${brief}`].join("\n"),
      },
    ],
    max_tokens: 800,
  });

  const content = completion.content.trim();
  const actions = content
    .split(/\n+/)
    .map((l) => l.replace(/^[-*•\d.]+\s*/, "").trim())
    .filter((l) => l.length > 8)
    .slice(0, 6);

  const output: Record<string, unknown> = {
    content,
    actions: actions.length > 0 ? actions : ["Qualify lead", "Schedule follow-up", "Update stage"],
    dry_run: dryRun.output,
  };

  requireValid(CRM_ASSIST_SKILL_SPEC.output_schema, output, "output");
  return output;
}

export async function executeWithKernel(
  kernel: KernelClient,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return execute({ kernel, input });
}

export const packageName = "@at72-verse/skill-crm-assist" as const;
