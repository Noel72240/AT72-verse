/**
 * @at72-verse/tool-social-publish — Phase 27a / DU4
 * Dry-run only: validates intent, no external network (live = Phase 28).
 */
import type { ToolExecuteContext, ToolSpec } from "@at72-verse/contracts";

export const TOOL_ID = "social-publish" as const;

export const SOCIAL_PUBLISH_TOOL_SPEC: ToolSpec = {
  id: TOOL_ID,
  version: "0.1.0",
  description: "Publish or schedule a social post (dry-run only until Phase 28).",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["platform", "content"],
    properties: {
      platform: { type: "string", minLength: 1 },
      content: { type: "string", minLength: 1 },
      scheduled_at: { type: "string" },
    },
  },
  output_schema: {
    type: "object",
    additionalProperties: false,
    required: ["mode", "would_publish", "platform", "content"],
    properties: {
      mode: { type: "string" },
      would_publish: { type: "boolean" },
      platform: { type: "string" },
      content: { type: "string" },
      scheduled_at: { type: "string" },
    },
  },
  side_effect: true,
  auth: { type: "oauth" },
  timeout_ms: 15000,
  permission: "tool.execute:social-publish",
  categories: ["social"],
  package: { kind: "tool", package_id: "pkg.tool.social-publish" },
};

export const toolSpec = SOCIAL_PUBLISH_TOOL_SPEC;

export async function execute(ctx: ToolExecuteContext): Promise<Record<string, unknown>> {
  const platform = String(ctx.input.platform ?? "").trim();
  const content = String(ctx.input.content ?? "").trim();
  const scheduled_at =
    typeof ctx.input.scheduled_at === "string" && ctx.input.scheduled_at.trim().length > 0
      ? ctx.input.scheduled_at.trim()
      : undefined;

  return {
    mode: "dry_run",
    would_publish: true,
    platform,
    content,
    ...(scheduled_at ? { scheduled_at } : {}),
  };
}

export const packageName = "@at72-verse/tool-social-publish" as const;
