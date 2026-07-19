/**
 * Audit sink for Tool executions (Phase 19 / DM8).
 * Hosts wire Prisma; tests use in-memory.
 */
export type ToolExecutionAuditStatus =
  | "completed"
  | "failed"
  | "forbidden"
  | "timeout"
  | "invalid_input"
  | "invalid_output";

export type ToolExecutionAuditRecord = {
  execution_id: string;
  organization_id: string;
  workspace_id: string;
  run_id: string | null;
  step_id: string | null;
  trace_id: string | null;
  agent_id: string;
  tool_id: string;
  tool_version: string | null;
  status: ToolExecutionAuditStatus;
  duration_ms: number;
  error: string | null;
  input_summary: string | null;
  output_summary: string | null;
  created_at: string;
};

export type ToolExecutionAuditPort = {
  record(entry: ToolExecutionAuditRecord): Promise<void>;
};

export class InMemoryToolExecutionAudit implements ToolExecutionAuditPort {
  readonly entries: ToolExecutionAuditRecord[] = [];

  async record(entry: ToolExecutionAuditRecord): Promise<void> {
    this.entries.push(Object.freeze({ ...entry }));
  }
}
