/**
 * @at72-verse/tool-crm-sync — Phase 27c / DW3
 * Dry-run only: deterministic intent, no CRM network (live = Phase 28).
 */
import type { ToolExecuteContext, ToolSpec } from "@at72-verse/contracts";

export const TOOL_ID = "crm-sync" as const;

export const CRM_SYNC_TOOL_SPEC: ToolSpec = {
  id: TOOL_ID,
  version: "0.1.0",
  description: "Sync CRM records (dry-run only until Phase 28 — no network).",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["object_type", "operation"],
    properties: {
      object_type: { type: "string", minLength: 1 },
      operation: { type: "string", minLength: 1 },
      record: { type: "object", additionalProperties: true },
    },
  },
  output_schema: {
    type: "object",
    additionalProperties: false,
    required: ["mode", "would_sync", "object_type", "operation"],
    properties: {
      mode: { type: "string" },
      would_sync: { type: "boolean" },
      object_type: { type: "string" },
      operation: { type: "string" },
      record_preview: { type: "object", additionalProperties: true },
    },
  },
  side_effect: true,
  auth: { type: "oauth" },
  timeout_ms: 15000,
  permission: "tool.execute:crm-sync",
  categories: ["crm"],
  package: { kind: "tool", package_id: "pkg.tool.crm-sync" },
};

export const toolSpec = CRM_SYNC_TOOL_SPEC;

export async function execute(ctx: ToolExecuteContext): Promise<Record<string, unknown>> {
  const object_type = String(ctx.input.object_type ?? "").trim();
  const operation = String(ctx.input.operation ?? "").trim();
  const record =
    ctx.input.record && typeof ctx.input.record === "object" && !Array.isArray(ctx.input.record)
      ? (ctx.input.record as Record<string, unknown>)
      : {};

  const record_preview: Record<string, unknown> = {};
  for (const key of Object.keys(record).sort()) {
    const v = record[key];
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      record_preview[key] = v;
    } else if (v == null) {
      record_preview[key] = null;
    } else {
      record_preview[key] = String(v).slice(0, 80);
    }
  }

  return {
    mode: "dry_run",
    would_sync: true,
    object_type,
    operation,
    ...(Object.keys(record_preview).length > 0 ? { record_preview } : {}),
  };
}

export const packageName = "@at72-verse/tool-crm-sync" as const;
