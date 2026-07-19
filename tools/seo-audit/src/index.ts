/**
 * @at72-verse/tool-seo-audit — Phase 23 / DQ5
 * Deterministic stub — no external network.
 */
import type { ToolExecuteContext, ToolSpec } from "@at72-verse/contracts";

export const TOOL_ID = "seo-audit" as const;

export const SEO_AUDIT_TOOL_SPEC: ToolSpec = {
  id: TOOL_ID,
  version: "0.1.0",
  description: "Run a read-only SEO audit for a URL or page topic (stub, no network).",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["url"],
    properties: {
      url: { type: "string", minLength: 1 },
      focus: { type: "string" },
    },
  },
  output_schema: {
    type: "object",
    additionalProperties: false,
    required: ["score", "findings"],
    properties: {
      score: { type: "number" },
      findings: { type: "array", items: { type: "string" } },
      url: { type: "string" },
    },
  },
  side_effect: false,
  auth: { type: "none" },
  timeout_ms: 15000,
  permission: "tool.execute:seo-audit",
  categories: ["seo"],
  package: { kind: "tool", package_id: "pkg.tool.seo-audit" },
};

export const toolSpec = SEO_AUDIT_TOOL_SPEC;

export async function execute(ctx: ToolExecuteContext): Promise<Record<string, unknown>> {
  const url = String(ctx.input.url ?? "").trim();
  const focus =
    typeof ctx.input.focus === "string" && ctx.input.focus.trim().length > 0
      ? ctx.input.focus.trim()
      : "general";
  const score = Math.min(100, 55 + (url.length % 40));
  return {
    url,
    score,
    findings: [
      `Stub SEO audit for ${url} (focus: ${focus}).`,
      "Title tag length looks acceptable (deterministic stub).",
      "Add structured data and internal links (stub recommendation).",
    ],
  };
}

export const packageName = "@at72-verse/tool-seo-audit" as const;
