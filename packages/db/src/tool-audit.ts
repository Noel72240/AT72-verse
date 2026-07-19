/**
 * ToolExecution audit via Prisma (Phase 19 / DM8).
 * Structurally compatible with verse-core ToolExecutionAuditPort.
 */
import type { PrismaClient } from "./client.js";

export type ToolExecutionAuditEntry = {
  execution_id: string;
  organization_id: string;
  workspace_id: string;
  run_id: string | null;
  step_id: string | null;
  trace_id: string | null;
  agent_id: string;
  tool_id: string;
  tool_version: string | null;
  status: string;
  duration_ms: number;
  error: string | null;
  input_summary: string | null;
  output_summary: string | null;
  created_at: string;
};

export type ToolExecutionAuditRepository = {
  record(entry: ToolExecutionAuditEntry): Promise<void>;
};

export function createPrismaToolExecutionAudit(
  prisma: PrismaClient,
): ToolExecutionAuditRepository {
  return {
    async record(entry: ToolExecutionAuditEntry): Promise<void> {
      // In-process delegation can run tools before the API projector inserts RunStep.
      let stepId = entry.step_id;
      if (stepId) {
        const step = await prisma.runStep.findUnique({
          where: { id: stepId },
          select: { id: true },
        });
        if (!step) {
          stepId = null;
        }
      }
      await prisma.toolExecution.create({
        data: {
          id: entry.execution_id,
          organizationId: entry.organization_id,
          workspaceId: entry.workspace_id,
          runId: entry.run_id,
          stepId,
          traceId: entry.trace_id,
          agentId: entry.agent_id,
          toolId: entry.tool_id,
          toolVersion: entry.tool_version,
          status: entry.status,
          durationMs: entry.duration_ms,
          error: entry.error,
          inputSummary: entry.input_summary,
          outputSummary: entry.output_summary,
          createdAt: new Date(entry.created_at),
        },
      });
    },
  };
}
