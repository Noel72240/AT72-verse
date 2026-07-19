/**
 * @at72-verse/tool-web-search — Phase 19 / DM4 · DM6
 * No arbitrary HTTP; search via WebSearchPort only (anti-SSRF).
 */
import type { ToolExecuteContext, ToolSpec } from "@at72-verse/contracts";

export const TOOL_ID = "web-search" as const;

export const WEB_SEARCH_TOOL_SPEC: ToolSpec = {
  id: TOOL_ID,
  version: "0.1.0",
  description: "Search the web for public information (no arbitrary URL fetch).",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["query"],
    properties: {
      query: { type: "string", minLength: 1 },
      limit: { type: "integer", minimum: 1, maximum: 10 },
    },
  },
  output_schema: {
    type: "object",
    additionalProperties: false,
    required: ["results"],
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "url", "snippet"],
          properties: {
            title: { type: "string" },
            url: { type: "string" },
            snippet: { type: "string" },
          },
        },
      },
    },
  },
  side_effect: false,
  auth: { type: "none" },
  timeout_ms: 15000,
  permission: "tool.execute:web-search",
  categories: ["research"],
  package: { kind: "tool", package_id: "pkg.tool.web-search" },
};

export const toolSpec = WEB_SEARCH_TOOL_SPEC;

export type WebSearchHit = {
  title: string;
  url: string;
  snippet: string;
};

/** Abstract search provider — never expose raw HTTP fetch to callers (DM6). */
export type WebSearchPort = {
  search(query: string, limit: number): Promise<WebSearchHit[]>;
};

/**
 * Deterministic stub for CI / default — no network.
 */
export class StubWebSearchProvider implements WebSearchPort {
  async search(query: string, limit: number): Promise<WebSearchHit[]> {
    const q = query.trim();
    const hits: WebSearchHit[] = [
      {
        title: `Result for: ${q}`,
        url: `https://example.com/search?q=${encodeURIComponent(q)}`,
        snippet: `Deterministic stub snippet about “${q}” for Verse tool tests.`,
      },
    ];
    return hits.slice(0, Math.max(1, Math.min(limit, 10)));
  }
}

let activeProvider: WebSearchPort = new StubWebSearchProvider();

/** Host / tests may swap provider without changing Kernel.tools API. */
export function setWebSearchProvider(provider: WebSearchPort): void {
  activeProvider = provider;
}

export function getWebSearchProvider(): WebSearchPort {
  return activeProvider;
}

export async function execute(ctx: ToolExecuteContext): Promise<Record<string, unknown>> {
  const query = String(ctx.input.query ?? "").trim();
  const limit =
    typeof ctx.input.limit === "number" && Number.isFinite(ctx.input.limit)
      ? Math.floor(ctx.input.limit)
      : 5;
  const results = await activeProvider.search(query, limit);
  return { results };
}

export const packageName = "@at72-verse/tool-web-search" as const;
