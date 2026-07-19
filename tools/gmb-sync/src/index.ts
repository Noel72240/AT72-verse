/**
 * @at72-verse/tool-gmb-sync — Phase 27a / DU4
 * Dry-run only: validates intent, no external network (live = Phase 28).
 */
import type { ToolExecuteContext, ToolSpec } from "@at72-verse/contracts";

export const TOOL_ID = "gmb-sync" as const;

export const GMB_SYNC_TOOL_SPEC: ToolSpec = {
  id: TOOL_ID,
  version: "0.1.0",
  description: "Sync Google Business Profile data (dry-run only until Phase 28).",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["place_id", "action"],
    properties: {
      place_id: { type: "string", minLength: 1 },
      action: { type: "string", minLength: 1 },
      notes: { type: "string" },
    },
  },
  output_schema: {
    type: "object",
    additionalProperties: false,
    required: ["mode", "would_sync", "place_id", "action"],
    properties: {
      mode: { type: "string" },
      would_sync: { type: "boolean" },
      place_id: { type: "string" },
      action: { type: "string" },
      notes: { type: "string" },
    },
  },
  side_effect: true,
  auth: { type: "oauth" },
  timeout_ms: 15000,
  permission: "tool.execute:gmb-sync",
  categories: ["local"],
  package: { kind: "tool", package_id: "pkg.tool.gmb-sync" },
};

export const toolSpec = GMB_SYNC_TOOL_SPEC;

export async function execute(ctx: ToolExecuteContext): Promise<Record<string, unknown>> {
  const place_id = String(ctx.input.place_id ?? "").trim();
  const action = String(ctx.input.action ?? "").trim();
  const notes =
    typeof ctx.input.notes === "string" && ctx.input.notes.trim().length > 0
      ? ctx.input.notes.trim()
      : undefined;

  return {
    mode: "dry_run",
    would_sync: true,
    place_id,
    action,
    ...(notes ? { notes } : {}),
  };
}

export const packageName = "@at72-verse/tool-gmb-sync" as const;
