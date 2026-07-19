/**
 * @at72-verse/tool-file-read-write — Phase 19 / DM4 · DM7
 * Workspace-sandboxed virtual FS (in-memory per process for MVP).
 */
import { createHash } from "node:crypto";
import type { ToolExecuteContext, ToolSpec } from "@at72-verse/contracts";
import { KernelError } from "@at72-verse/verse-kernel";

export const TOOL_ID = "file-read-write" as const;

export const FILE_READ_WRITE_TOOL_SPEC: ToolSpec = {
  id: TOOL_ID,
  version: "0.1.0",
  description: "Read/write text files inside the workspace sandbox only.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["op", "path"],
    properties: {
      op: { type: "string", enum: ["read", "write", "list"] },
      path: { type: "string", minLength: 1 },
      content: { type: "string" },
    },
  },
  output_schema: {
    type: "object",
    additionalProperties: false,
    required: ["ok"],
    properties: {
      ok: { type: "boolean" },
      content: { type: "string" },
      entries: { type: "array", items: { type: "string" } },
      path: { type: "string" },
    },
  },
  side_effect: true,
  auth: { type: "none" },
  timeout_ms: 10000,
  permission: "tool.execute:file-read-write",
  categories: ["files"],
  package: { kind: "tool", package_id: "pkg.tool.file-read-write" },
};

export const toolSpec = FILE_READ_WRITE_TOOL_SPEC;

const MAX_BYTES = 64 * 1024;

/** path → content, keyed by workspace root */
const stores = new Map<string, Map<string, string>>();

function workspaceKey(org: string, ws: string): string {
  return `${org}::${ws}`;
}

/**
 * Resolve a relative workspace path — rejects traversal and absolute paths (DM7).
 */
export function resolveSandboxPath(raw: string): string {
  const trimmed = raw.trim().replace(/\\/g, "/");
  if (!trimmed || trimmed.startsWith("/") || /^[a-zA-Z]:/.test(trimmed)) {
    throw new KernelError("FORBIDDEN", "Absolute paths are not allowed in workspace sandbox", {
      details: { path: raw },
    });
  }
  const parts = trimmed.split("/").filter((p) => p.length > 0 && p !== ".");
  if (parts.some((p) => p === "..")) {
    throw new KernelError("FORBIDDEN", "Path traversal is not allowed", {
      details: { path: raw },
    });
  }
  if (parts.length === 0) {
    throw new KernelError("INVALID_INPUT", "Empty path after normalization", {
      details: { path: raw },
    });
  }
  return parts.join("/");
}

function getStore(org: string, ws: string): Map<string, string> {
  const key = workspaceKey(org, ws);
  let store = stores.get(key);
  if (!store) {
    store = new Map();
    stores.set(key, store);
  }
  return store;
}

/** Test helper */
export function clearWorkspaceFiles(org?: string, ws?: string): void {
  if (org && ws) {
    stores.delete(workspaceKey(org, ws));
  } else {
    stores.clear();
  }
}

export async function execute(ctx: ToolExecuteContext): Promise<Record<string, unknown>> {
  const op = String(ctx.input.op ?? "");
  const path = resolveSandboxPath(String(ctx.input.path ?? ""));
  const store = getStore(ctx.organization_id, ctx.workspace_id);

  if (op === "list") {
    const under = [...store.keys()].filter((p) => p === path || p.startsWith(`${path}/`)).sort();
    return { ok: true, path, entries: under };
  }

  if (op === "read") {
    const content = store.get(path);
    if (content === undefined) {
      throw new KernelError("NOT_FOUND", `File not found in workspace sandbox: ${path}`, {
        details: { path },
      });
    }
    return { ok: true, path, content };
  }

  if (op === "write") {
    const content = typeof ctx.input.content === "string" ? ctx.input.content : "";
    const bytes = Buffer.byteLength(content, "utf8");
    if (bytes > MAX_BYTES) {
      throw new KernelError("INVALID_INPUT", `File exceeds max size (${MAX_BYTES} bytes)`, {
        details: { path, bytes },
      });
    }
    store.set(path, content);
    return {
      ok: true,
      path,
      content: `written:${createHash("sha256").update(content).digest("hex").slice(0, 12)}`,
    };
  }

  throw new KernelError("INVALID_INPUT", `Unsupported op: ${op}`, { details: { op } });
}

export const packageName = "@at72-verse/tool-file-read-write" as const;
