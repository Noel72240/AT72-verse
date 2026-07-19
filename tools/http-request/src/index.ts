/**
 * @at72-verse/tool-http-request — Phase 27b / DV3
 * Dry-run only: validates intent, no fetch / network (live = Phase 28).
 */
import type { ToolExecuteContext, ToolSpec } from "@at72-verse/contracts";

export const TOOL_ID = "http-request" as const;

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

export const HTTP_REQUEST_TOOL_SPEC: ToolSpec = {
  id: TOOL_ID,
  version: "0.1.0",
  description: "Issue an HTTP request (dry-run only until Phase 28 — no network).",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["method", "url"],
    properties: {
      method: { type: "string", minLength: 1 },
      url: { type: "string", minLength: 1 },
      headers: { type: "object", additionalProperties: { type: "string" } },
      body: { type: "string" },
    },
  },
  output_schema: {
    type: "object",
    additionalProperties: false,
    required: ["mode", "would_request", "method", "url"],
    properties: {
      mode: { type: "string" },
      would_request: { type: "boolean" },
      method: { type: "string" },
      url: { type: "string" },
      headers_keys: { type: "array", items: { type: "string" } },
      body_preview: { type: "string" },
    },
  },
  side_effect: true,
  auth: { type: "none" },
  timeout_ms: 15000,
  permission: "tool.execute:http-request",
  categories: ["automation", "http"],
  package: { kind: "tool", package_id: "pkg.tool.http-request" },
};

export const toolSpec = HTTP_REQUEST_TOOL_SPEC;

export async function execute(ctx: ToolExecuteContext): Promise<Record<string, unknown>> {
  const method = String(ctx.input.method ?? "")
    .trim()
    .toUpperCase();
  const url = String(ctx.input.url ?? "").trim();

  if (!ALLOWED_METHODS.has(method)) {
    throw new Error(`http-request dry-run: method not allowed: ${method}`);
  }
  if (!/^https?:\/\//i.test(url)) {
    throw new Error("http-request dry-run: url must be absolute http(s)");
  }

  const headers =
    ctx.input.headers && typeof ctx.input.headers === "object" && !Array.isArray(ctx.input.headers)
      ? (ctx.input.headers as Record<string, string>)
      : {};
  const headers_keys = Object.keys(headers).sort();
  const body =
    typeof ctx.input.body === "string" && ctx.input.body.trim().length > 0
      ? ctx.input.body.trim()
      : undefined;

  return {
    mode: "dry_run",
    would_request: true,
    method,
    url,
    ...(headers_keys.length > 0 ? { headers_keys } : {}),
    ...(body ? { body_preview: body.slice(0, 200) } : {}),
  };
}

export const packageName = "@at72-verse/tool-http-request" as const;
