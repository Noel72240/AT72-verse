/**
 * Tool plugin contracts (Phase 19 / DM2).
 * Tools depend on contracts only — never agents, skills, or Core.
 */
import type { ToolSpec } from "./tool-spec.js";

export type ToolExecuteContext = {
  input: Record<string, unknown>;
  /** Tenant / run correlation for sandboxed tools (never secrets). */
  organization_id: string;
  workspace_id: string;
  run_id: string;
  agent_id: string;
  /**
   * Ephemeral OAuth material injected by Core ToolRuntime only (Phase 28b / ADR-013).
   * Never set by Agents/Skills. Never persist, log, or publish on the bus.
   */
  oauth?: {
    provider: string;
    access_token: string;
  };
};

/**
 * Minimal tool module surface (DM2).
 * Packages export `TOOL_ID`, `toolSpec` (or alias), and `execute`.
 */
export type ToolModule = {
  id: string;
  spec: ToolSpec;
  execute: (ctx: ToolExecuteContext) => Promise<Record<string, unknown>>;
};

/** Host-side tool registry entry (Runtime — DM3). Not used inside tool packages. */
export type ToolPlugin = {
  id: string;
  version: string;
  spec: ToolSpec;
  execute: (ctx: ToolExecuteContext) => Promise<Record<string, unknown>>;
};
