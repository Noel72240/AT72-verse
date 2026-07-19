import {
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { createPrismaToolExecutionAudit, type PrismaClient } from "@at72-verse/db";
import type { VerseCore } from "@at72-verse/verse-core";
import { PRISMA } from "../auth/auth.tokens.js";
import { VERSE_CORE } from "../core/core.tokens.js";
import { RbacService } from "../rbac/rbac.service.js";

@Injectable()
export class ToolsService implements OnModuleInit {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(VERSE_CORE) private readonly core: VerseCore,
    private readonly rbac: RbacService,
  ) {}

  onModuleInit(): void {
    this.core.setToolAudit(createPrismaToolExecutionAudit(this.prisma));
  }

  async listForWorkspace(
    workspaceId: string,
    userId: string,
    opts?: { runId?: string; toolId?: string; limit?: number },
  ) {
    const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!ws) {
      throw new NotFoundException({ code: "not_found", message: "Workspace not found" });
    }
    await this.rbac.requireWorkspaceMember(userId, workspaceId, "VIEWER");

    const limit = Math.min(opts?.limit ?? 50, 200);
    const rows = await this.prisma.toolExecution.findMany({
      where: {
        organizationId: ws.organizationId,
        workspaceId,
        ...(opts?.runId ? { runId: opts.runId } : {}),
        ...(opts?.toolId ? { toolId: opts.toolId } : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: limit,
    });

    return {
      executions: rows.map((row) => ({
        execution_id: row.id,
        organization_id: row.organizationId,
        workspace_id: row.workspaceId,
        run_id: row.runId,
        step_id: row.stepId,
        trace_id: row.traceId,
        agent_id: row.agentId,
        tool_id: row.toolId,
        tool_version: row.toolVersion,
        status: row.status,
        duration_ms: row.durationMs,
        error: row.error,
        input_summary: row.inputSummary,
        output_summary: row.outputSummary,
        created_at: row.createdAt.toISOString(),
      })),
    };
  }

  async listForRun(runId: string, userId: string, opts?: { limit?: number }) {
    const run = await this.prisma.run.findUnique({ where: { id: runId } });
    if (!run) {
      throw new NotFoundException({ code: "not_found", message: "Run not found" });
    }
    await this.rbac.requireWorkspaceMember(userId, run.workspaceId, "VIEWER");

    const limit = Math.min(opts?.limit ?? 50, 200);
    const rows = await this.prisma.toolExecution.findMany({
      where: { organizationId: run.organizationId, runId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: limit,
    });

    return {
      executions: rows.map((row) => ({
        execution_id: row.id,
        organization_id: row.organizationId,
        workspace_id: row.workspaceId,
        run_id: row.runId,
        step_id: row.stepId,
        trace_id: row.traceId,
        agent_id: row.agentId,
        tool_id: row.toolId,
        tool_version: row.toolVersion,
        status: row.status,
        duration_ms: row.durationMs,
        error: row.error,
        input_summary: row.inputSummary,
        output_summary: row.outputSummary,
        created_at: row.createdAt.toISOString(),
      })),
    };
  }
}
