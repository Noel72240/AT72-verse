/**
 * @at72-verse/tool-image-generate — Phase 23 / DQ5
 * Side-effect stub — no external image provider.
 */
import type { ToolExecuteContext, ToolSpec } from "@at72-verse/contracts";

export const TOOL_ID = "image-generate" as const;

export const IMAGE_GENERATE_TOOL_SPEC: ToolSpec = {
  id: TOOL_ID,
  version: "0.1.0",
  description: "Generate an image artifact from a prompt (local stub, side-effect).",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["prompt"],
    properties: {
      prompt: { type: "string", minLength: 1 },
      aspect_ratio: { type: "string" },
    },
  },
  output_schema: {
    type: "object",
    additionalProperties: false,
    required: ["artifact_id", "url", "prompt"],
    properties: {
      artifact_id: { type: "string" },
      url: { type: "string" },
      prompt: { type: "string" },
      aspect_ratio: { type: "string" },
    },
  },
  side_effect: true,
  auth: { type: "none" },
  timeout_ms: 30000,
  permission: "tool.execute:image-generate",
  categories: ["design", "image"],
  package: { kind: "tool", package_id: "pkg.tool.image-generate" },
};

export const toolSpec = IMAGE_GENERATE_TOOL_SPEC;

export async function execute(ctx: ToolExecuteContext): Promise<Record<string, unknown>> {
  const prompt = String(ctx.input.prompt ?? "").trim();
  const aspect =
    typeof ctx.input.aspect_ratio === "string" && ctx.input.aspect_ratio.trim().length > 0
      ? ctx.input.aspect_ratio.trim()
      : "1:1";
  const slug = prompt
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  const artifactId = `img_stub_${slug || "blank"}_${ctx.run_id.slice(0, 8)}`;
  return {
    artifact_id: artifactId,
    url: `https://example.com/stub-images/${artifactId}.png`,
    prompt,
    aspect_ratio: aspect,
  };
}

export const packageName = "@at72-verse/tool-image-generate" as const;
