/**
 * skill.image-generation — Phase 23 / DQ4 · DQ5
 * Produces an image brief via LLM; image-generate tool only when use_image_generate === true.
 */
import type { KernelClient, SkillExecuteContext, SkillSpec } from "@at72-verse/contracts";
import { validateDataAgainstJsonSchema } from "@at72-verse/contracts";
import { KernelError } from "@at72-verse/verse-kernel";

export const SKILL_ID = "skill.image-generation" as const;

export const IMAGE_GENERATION_SKILL_SPEC: SkillSpec = {
  id: SKILL_ID,
  version: "0.1.0",
  name: "Image Generation",
  description:
    "Reusable image brief skill via Kernel.llm; optional explicit image-generate tool (side-effect).",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["brief"],
    properties: {
      brief: { type: "string", minLength: 1 },
      style: { type: "string" },
      formality: { type: "string" },
      rules: { type: "string" },
      /** Explicit opt-in — grant disabled by default (DQ5). */
      use_image_generate: { type: "boolean" },
      aspect_ratio: { type: "string" },
    },
  },
  output_schema: {
    type: "object",
    additionalProperties: false,
    required: ["content", "prompt"],
    properties: {
      content: { type: "string", minLength: 1 },
      prompt: { type: "string", minLength: 1 },
      artifact_id: { type: "string" },
      url: { type: "string" },
    },
  },
  default_model_profile: "creative-balanced",
  persona_hints: { prefer_style: "visual" },
  tags: ["image", "design"],
  eval_suite: "evals/image-generation-v0",
  permissions: ["skill.invoke:image-generation"],
};

export const skillSpec = IMAGE_GENERATION_SKILL_SPEC;

function requireValid(schema: Record<string, unknown>, data: unknown, label: string): void {
  const result = validateDataAgainstJsonSchema(schema, data);
  if (!result.ok) {
    throw new KernelError(
      "INVALID_INPUT",
      `skill.image-generation ${label} schema validation failed`,
      { details: { errors: result.errors } },
    );
  }
}

export async function execute(ctx: SkillExecuteContext): Promise<Record<string, unknown>> {
  requireValid(IMAGE_GENERATION_SKILL_SPEC.input_schema, ctx.input, "input");

  const brief = String(ctx.input.brief);
  const style = typeof ctx.input.style === "string" ? ctx.input.style : "clean modern";
  const formality =
    typeof ctx.input.formality === "string" && ctx.input.formality.trim().length > 0
      ? ctx.input.formality.trim()
      : null;
  const rules =
    typeof ctx.input.rules === "string" && ctx.input.rules.trim().length > 0
      ? ctx.input.rules.trim()
      : null;
  const useImage = ctx.input.use_image_generate === true;
  const aspect =
    typeof ctx.input.aspect_ratio === "string" && ctx.input.aspect_ratio.trim().length > 0
      ? ctx.input.aspect_ratio.trim()
      : "1:1";

  const systemParts = [
    "You are a visual creative director. Produce a precise image generation prompt and a short creative brief.",
  ];
  if (formality) systemParts.push(`Formality: ${formality}.`);
  if (rules) systemParts.push(`Rules:\n${rules}`);

  const completion = await ctx.kernel.llm.complete({
    profile: "creative-balanced",
    messages: [
      { role: "system", content: systemParts.join(" ") },
      {
        role: "user",
        content: `Style: ${style}\nAspect: ${aspect}\nBrief:\n${brief}`,
      },
    ],
    max_tokens: 600,
  });

  const content = completion.content.trim();
  const promptLine = content.split("\n").find((l) => l.trim().length > 0) ?? content;
  const prompt = promptLine.replace(/^prompt\s*:\s*/i, "").trim() || brief;

  const output: Record<string, unknown> = {
    content,
    prompt,
  };

  if (useImage) {
    const toolResult = await ctx.kernel.tools.execute({
      tool_id: "image-generate",
      input: { prompt, aspect_ratio: aspect },
    });
    if (typeof toolResult.output.artifact_id === "string") {
      output.artifact_id = toolResult.output.artifact_id;
    }
    if (typeof toolResult.output.url === "string") {
      output.url = toolResult.output.url;
    }
  }

  requireValid(IMAGE_GENERATION_SKILL_SPEC.output_schema, output, "output");
  return output;
}

export async function executeWithKernel(
  kernel: KernelClient,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return execute({ kernel, input });
}

export const packageName = "@at72-verse/skill-image-generation" as const;
