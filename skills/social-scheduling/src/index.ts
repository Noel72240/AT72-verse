/**
 * skill.social-scheduling — Phase 27a / 28b
 * Plans social posts via Kernel.tools social-publish (dry-run default; mode=live opt-in).
 */
import type { KernelClient, SkillExecuteContext, SkillSpec } from "@at72-verse/contracts";
import { validateDataAgainstJsonSchema } from "@at72-verse/contracts";
import { KernelError } from "@at72-verse/verse-kernel";

export const SKILL_ID = "skill.social-scheduling" as const;

export const SOCIAL_SCHEDULING_SKILL_SPEC: SkillSpec = {
  id: SKILL_ID,
  version: "0.2.0",
  name: "Social Scheduling",
  description: "Social post planning via social-publish (dry-run default; live opt-in).",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["brief"],
    properties: {
      brief: { type: "string", minLength: 1 },
      platform: { type: "string" },
      formality: { type: "string" },
      rules: { type: "string" },
      mode: { type: "string", enum: ["dry_run", "live"] },
      /** When true, treat brief as final post body (skip LLM rewrite). */
      publish_as_is: { type: "boolean" },
      image_url: { type: "string" },
    },
  },
  output_schema: {
    type: "object",
    additionalProperties: false,
    required: ["content", "posts"],
    properties: {
      content: { type: "string", minLength: 1 },
      posts: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: true,
        },
      },
      dry_run: { type: "object", additionalProperties: true },
      publish_result: { type: "object", additionalProperties: true },
      mode: { type: "string" },
    },
  },
  default_model_profile: "creative-balanced",
  persona_hints: { prefer_style: "structured" },
  tags: ["social", "scheduling"],
  eval_suite: "evals/social-scheduling-v0",
  permissions: ["skill.invoke:social-scheduling"],
};

export const skillSpec = SOCIAL_SCHEDULING_SKILL_SPEC;

function requireValid(schema: Record<string, unknown>, data: unknown, label: string): void {
  const result = validateDataAgainstJsonSchema(schema, data);
  if (!result.ok) {
    throw new KernelError("INVALID_INPUT", `skill.social-scheduling ${label} schema validation failed`, {
      details: { errors: result.errors },
    });
  }
}

export async function execute(ctx: SkillExecuteContext): Promise<Record<string, unknown>> {
  requireValid(SOCIAL_SCHEDULING_SKILL_SPEC.input_schema, ctx.input, "input");

  const brief = String(ctx.input.brief);
  const platform =
    typeof ctx.input.platform === "string" && ctx.input.platform.trim().length > 0
      ? ctx.input.platform.trim()
      : "linkedin";
  const formality =
    typeof ctx.input.formality === "string" && ctx.input.formality.trim().length > 0
      ? ctx.input.formality.trim()
      : null;
  const rules =
    typeof ctx.input.rules === "string" && ctx.input.rules.trim().length > 0
      ? ctx.input.rules.trim()
      : null;
  const mode = ctx.input.mode === "live" ? "live" : "dry_run";
  const publishAsIs = ctx.input.publish_as_is === true;
  const imageUrl =
    typeof ctx.input.image_url === "string" && ctx.input.image_url.trim().startsWith("https://")
      ? ctx.input.image_url.trim()
      : undefined;

  const postBody = brief.slice(0, 3000);

  const toolResult = await ctx.kernel.tools.execute({
    tool_id: "social-publish",
    input: {
      platform,
      content: postBody,
      ...(mode === "dry_run" ? { scheduled_at: "2026-07-20T09:00:00.000Z" } : {}),
      mode,
      ...(imageUrl ? { image_url: imageUrl } : {}),
    },
  });

  // Ready-to-publish drafts (from Adam chat) — skip a second LLM rewrite.
  if (publishAsIs) {
    const label =
      platform.toLowerCase() === "facebook"
        ? "Facebook"
        : platform.toLowerCase() === "instagram"
          ? "Instagram"
          : "LinkedIn";
    const content =
      mode === "live"
        ? [
            `✅ Publié sur ${label}.`,
            typeof toolResult.output?.external_post_id === "string"
              ? `ID : ${toolResult.output.external_post_id}`
              : null,
            "",
            postBody,
          ]
            .filter((line) => line !== null)
            .join("\n")
        : [
            `✅ Simulation ${label} (dry-run) — rien n'a été publié pour de vrai.`,
            "",
            postBody,
            "",
            `Ensuite : connecte ${label} sur /connectors, puis dis « publie en live ».`,
          ].join("\n");

    const output: Record<string, unknown> = {
      content,
      posts: [
        {
          platform,
          body: postBody,
          ...(mode === "dry_run" ? { scheduled_at: "2026-07-20T09:00:00.000Z" } : {}),
        },
      ],
      mode,
      ...(mode === "live"
        ? { publish_result: toolResult.output }
        : { dry_run: toolResult.output }),
    };
    requireValid(SOCIAL_SCHEDULING_SKILL_SPEC.output_schema, output, "output");
    return output;
  }

  const systemParts = [
    "You are a social media planner. Propose a short post calendar from the brief and publish intent.",
  ];
  if (formality) systemParts.push(`Formality: ${formality}.`);
  if (rules) systemParts.push(`Rules:\n${rules}`);

  const completion = await ctx.kernel.llm.complete({
    profile: "creative-balanced",
    messages: [
      { role: "system", content: systemParts.join(" ") },
      {
        role: "user",
        content: [
          `Platform: ${platform}`,
          `Publish result: ${JSON.stringify(toolResult.output)}`,
          `Brief:\n${brief}`,
        ].join("\n"),
      },
    ],
    max_tokens: 800,
  });

  const content = completion.content.trim();
  const output: Record<string, unknown> = {
    content,
    posts: [
      {
        platform,
        body: content.slice(0, 280),
        ...(mode === "dry_run" ? { scheduled_at: "2026-07-20T09:00:00.000Z" } : {}),
      },
    ],
    mode,
    ...(mode === "live"
      ? { publish_result: toolResult.output }
      : { dry_run: toolResult.output }),
  };

  requireValid(SOCIAL_SCHEDULING_SKILL_SPEC.output_schema, output, "output");
  return output;
}

export async function executeWithKernel(
  kernel: KernelClient,
  input: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return execute({ kernel, input });
}

export const packageName = "@at72-verse/skill-social-scheduling" as const;
