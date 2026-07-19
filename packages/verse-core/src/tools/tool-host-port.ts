/**
 * Host-provided tool execution port (Phase 19 / DM3).
 * Runtime registers tool packages; Core never imports tools/*.
 */
import type { ToolExecuteContext, ToolSpec } from "@at72-verse/contracts";

export type ToolHostPort = {
  resolve(toolId: string): Promise<{ id: string; version: string; spec: ToolSpec }>;
  execute(toolId: string, ctx: ToolExecuteContext): Promise<Record<string, unknown>>;
  listRegistered(): Promise<string[]>;
};
