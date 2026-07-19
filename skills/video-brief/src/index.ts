/**
 * skill.video-brief — Phase 27c / DW2 · DW4
 * Script / storyboard via video-pipeline dry-run (never renders).
 */
import type { KernelClient, SkillExecuteContext, SkillSpec } from "@at72-verse/contracts";
import { validateDataAgainstJsonSchema } from "@at72-verse/contracts";
import { KernelError } from "@at72-verse/verse-kernel";

export const SKILL_ID = "skill.video-brief" as const;

export const VIDEO_BRIEF_SKILL_SPEC: SkillSpec = {
  id: SKILL_ID,
  version: "0.1.0",
  name: "Video Brief",
  description: "Reusable video script / storyboard skill via dry-run video-pipeline + LLM.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["brief"],
    properties: {
      brief: { type: "string", minLength: 1 },
      format: { type: "string" },
      duration_s: { type: "number" },
      formality: { type: "string" },
      rules: { type: "string" },
    },
  },
  output_schema: {
    type: "object",
    additionalProperties: false,
    required: ["content", "storyboard", "dry_run"],
    properties: {
      content: { type: "string", minLength: 1 },
      storyboard: { type: "array", items: { type: "object", additionalProperties: true } },
      dry_run: { type: "object", additionalProperties: true },
    },
  },
  default_model_profile: "creative-balanced",
  persona_hints: { prefer_style: "structured" },
  tags: ["video", "storyboard"],
  eval_suite: "evals/video-brief-v0",
  permissions: ["skill.invoke:video-brief"],
};

export const skillSpec = VIDEO_BRIEF_SKILL_SPEC;

function requireValid(schema: Record<string, unknown>, data: unknown, label: string): void {
  const result = validateDataAgainstJsonSchema(schema, data);
  if (!result.ok) {
    throw new KernelError("INVALID_INPUT", `skill.video-brief ${label} schema validation failed`, {
      details: { errors: result.errors },
    });
  }
}

export async function execute(ctx: SkillExecuteContext): Promise<Record<string, unknown>> {
  requireValid(VIDEO_BRIEF_SKILL_SPEC.input_schema, ctx.input, "input");

  const brief = String(ctx.input.brief);
  const formality =
    typeof ctx.input.formality === "string" && ctx.input.formality.trim().length > 0
      ? ctx.input.formality.trim()
      : null;
  const rules =
    typeof ctx.input.rules === "string" && ctx.input.rules.trim().length > 0
      ? ctx.input.rules.trim()
      : null;

  const dryRun = await ctx.kernel.tools.execute({
    tool_id: "video-pipeline",
    input: {
      brief,
      ...(typeof ctx.input.format === "string" ? { format: ctx.input.format } : {}),
      ...(typeof ctx.input.duration_s === "number" ? { duration_s: ctx.input.duration_s } : {}),
    },
  });

  const systemParts = [
    "You are a video creative planner. Turn the storyboard dry-run into a concise script brief.",
    "Never claim video was rendered — storyboard only.",
  ];
  if (formality) systemParts.push(`Formality: ${formality}.`);
  if (rules) systemParts.push(`Rules:\n${rules}`);

  const completion = await ctx.kernel.llm.complete({
    profile: "creative-balanced",
    messages: [
      { role: "system", content: systemParts.join(" ") },
      {
        role: "user",
        content: [`Dry-run storyboard: ${JSON.stringify(dryRun.output)}`, `Brief:\n${brief}`].join(
          "\n",
        ),
      },
    ],
    max_tokens: 800,
  });

  const storyboard = Array.isArray(dryRun.output.storyboard)
    ? (dryRun.output.storyboard as Array<Record<string, unknown>>)
    : [];

  const output: Record<string, unknown> = {
    content: completion.content.trim(),
    storyboard,
    dry_run: dryRun.output,
  };

  requireValid(VIDEO_BRIEF_SKILL_SPEC.output_schema, output, "output");
  return output;
}

export async function executeWithKernel(
  kernel: KernelClient,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return execute({ kernel, input });
}

export const packageName = "@at72-verse/skill-video-brief" as const;
