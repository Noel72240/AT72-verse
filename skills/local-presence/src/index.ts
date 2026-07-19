/**
 * skill.local-presence — Phase 27a / DU3
 * Local / GBP presence via Kernel.tools gmb-sync (dry-run) + Kernel.llm.
 */
import type { KernelClient, SkillExecuteContext, SkillSpec } from "@at72-verse/contracts";
import { validateDataAgainstJsonSchema } from "@at72-verse/contracts";
import { KernelError } from "@at72-verse/verse-kernel";

export const SKILL_ID = "skill.local-presence" as const;

export const LOCAL_PRESENCE_SKILL_SPEC: SkillSpec = {
  id: SKILL_ID,
  version: "0.1.0",
  name: "Local Presence",
  description: "Reusable local / Google Business presence skill via dry-run gmb-sync + LLM.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["brief"],
    properties: {
      brief: { type: "string", minLength: 1 },
      place_id: { type: "string" },
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
  tags: ["local", "gmb"],
  eval_suite: "evals/local-presence-v0",
  permissions: ["skill.invoke:local-presence"],
};

export const skillSpec = LOCAL_PRESENCE_SKILL_SPEC;

function requireValid(schema: Record<string, unknown>, data: unknown, label: string): void {
  const result = validateDataAgainstJsonSchema(schema, data);
  if (!result.ok) {
    throw new KernelError("INVALID_INPUT", `skill.local-presence ${label} schema validation failed`, {
      details: { errors: result.errors },
    });
  }
}

export async function execute(ctx: SkillExecuteContext): Promise<Record<string, unknown>> {
  requireValid(LOCAL_PRESENCE_SKILL_SPEC.input_schema, ctx.input, "input");

  const brief = String(ctx.input.brief);
  const placeId =
    typeof ctx.input.place_id === "string" && ctx.input.place_id.trim().length > 0
      ? ctx.input.place_id.trim()
      : "places/stub-local-1";
  const formality =
    typeof ctx.input.formality === "string" && ctx.input.formality.trim().length > 0
      ? ctx.input.formality.trim()
      : null;
  const rules =
    typeof ctx.input.rules === "string" && ctx.input.rules.trim().length > 0
      ? ctx.input.rules.trim()
      : null;

  const dryRun = await ctx.kernel.tools.execute({
    tool_id: "gmb-sync",
    input: {
      place_id: placeId,
      action: "sync_profile",
      notes: brief.slice(0, 200),
    },
  });

  const systemParts = [
    "You are a local presence specialist. Turn dry-run GMB intent into concise actionable recommendations.",
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
          `Place: ${placeId}`,
          `Dry-run intent: ${JSON.stringify(dryRun.output)}`,
          `Brief:\n${brief}`,
        ].join("\n"),
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
    actions:
      actions.length > 0
        ? actions
        : ["Update business hours", "Reply to recent reviews", "Refresh primary category"],
    dry_run: dryRun.output,
  };

  requireValid(LOCAL_PRESENCE_SKILL_SPEC.output_schema, output, "output");
  return output;
}

export async function executeWithKernel(
  kernel: KernelClient,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return execute({ kernel, input });
}

export const packageName = "@at72-verse/skill-local-presence" as const;
