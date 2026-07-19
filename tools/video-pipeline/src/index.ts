/**
 * @at72-verse/tool-video-pipeline — Phase 27c / DW4
 * Dry-run storyboard only — would_render always false; no FFmpeg / providers.
 */
import type { ToolExecuteContext, ToolSpec } from "@at72-verse/contracts";

export const TOOL_ID = "video-pipeline" as const;

export const VIDEO_PIPELINE_TOOL_SPEC: ToolSpec = {
  id: TOOL_ID,
  version: "0.1.0",
  description: "Produce a deterministic video storyboard (dry-run — never renders).",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["brief"],
    properties: {
      brief: { type: "string", minLength: 1 },
      format: { type: "string" },
      duration_s: { type: "number" },
    },
  },
  output_schema: {
    type: "object",
    additionalProperties: false,
    required: ["mode", "would_render", "storyboard", "script_outline"],
    properties: {
      mode: { type: "string" },
      would_render: { type: "boolean" },
      storyboard: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: true,
        },
      },
      script_outline: { type: "string" },
      format: { type: "string" },
      duration_s: { type: "number" },
    },
  },
  side_effect: true,
  auth: { type: "none" },
  timeout_ms: 15000,
  permission: "tool.execute:video-pipeline",
  categories: ["video"],
  package: { kind: "tool", package_id: "pkg.tool.video-pipeline" },
};

export const toolSpec = VIDEO_PIPELINE_TOOL_SPEC;

export async function execute(ctx: ToolExecuteContext): Promise<Record<string, unknown>> {
  const brief = String(ctx.input.brief ?? "").trim();
  const format =
    typeof ctx.input.format === "string" && ctx.input.format.trim().length > 0
      ? ctx.input.format.trim()
      : "16:9";
  const duration_s =
    typeof ctx.input.duration_s === "number" && Number.isFinite(ctx.input.duration_s)
      ? Math.max(5, Math.min(120, Math.floor(ctx.input.duration_s)))
      : 30;

  const shotCount = 2 + (brief.length % 3);
  const storyboard = Array.from({ length: shotCount }, (_, i) => ({
    shot: i + 1,
    description: `Shot ${i + 1}: visual beat for «${brief.slice(0, 40)}» (${format})`,
  }));

  return {
    mode: "dry_run",
    would_render: false,
    storyboard,
    script_outline: `Outline (${duration_s}s): intro → value → CTA — derived from brief length ${brief.length}`,
    format,
    duration_s,
  };
}

export const packageName = "@at72-verse/tool-video-pipeline" as const;
