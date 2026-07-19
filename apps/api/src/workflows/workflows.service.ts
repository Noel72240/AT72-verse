import { randomUUID } from "node:crypto";
import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Bus } from "@at72-verse/bus";
import type {
  WorkflowDefinition,
  WorkflowRun,
  WorkflowRunStatus,
} from "@at72-verse/contracts";
import type { PrismaClient, Prisma } from "@at72-verse/db";
import {
  buildBudgetSnapshot,
  getFirstPartyWorkflowDefinitions,
  getWorkflowDefinitionById,
} from "@at72-verse/verse-core";
import { PRISMA } from "../auth/auth.tokens.js";
import { BUS } from "../core/bus.tokens.js";
import { PackagesService } from "../packages/packages.service.js";
import { RbacService } from "../rbac/rbac.service.js";

const WORKFLOW_TASKS_TOPIC = "verse.workflow.tasks";

function asJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

function toWorkflowRun(row: {
  id: string;
  organizationId: string;
  workspaceId: string;
  workflowId: string;
  workflowVersion: string;
  runId: string;
  status: string;
  definitionSnapshot: unknown;
  completedStepIds: unknown;
  cursorStepId: string | null;
  input: unknown;
  output: unknown;
  error: unknown;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
}): WorkflowRun {
  return {
    id: row.id,
    organization_id: row.organizationId,
    workspace_id: row.workspaceId,
    workflow_id: row.workflowId,
    workflow_version: row.workflowVersion,
    run_id: row.runId,
    status: row.status as WorkflowRunStatus,
    definition_snapshot: row.definitionSnapshot as WorkflowDefinition,
    completed_step_ids: Array.isArray(row.completedStepIds)
      ? (row.completedStepIds as string[])
      : [],
    cursor_step_id: row.cursorStepId,
    input: (row.input as Record<string, unknown>) ?? {},
    output: (row.output as Record<string, unknown>) ?? null,
    error: (row.error as Record<string, unknown>) ?? null,
    created_by_user_id: row.createdByUserId,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    started_at: row.startedAt?.toISOString() ?? null,
    completed_at: row.completedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class WorkflowsService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(BUS) private readonly bus: Bus,
    @Inject(RbacService) private readonly rbac: RbacService,
    @Inject(PackagesService) private readonly packages: PackagesService,
  ) {}

  listDefinitions(): { workflows: WorkflowDefinition[] } {
    return { workflows: getFirstPartyWorkflowDefinitions() };
  }

  async getWorkflowRun(workflowRunId: string, userId: string): Promise<{ workflow_run: WorkflowRun }> {
    const row = await this.prisma.workflowRunRow.findUnique({ where: { id: workflowRunId } });
    if (!row) {
      throw new NotFoundException({ code: "not_found", message: "Workflow run not found" });
    }
    await this.rbac.requireWorkspaceMember(userId, row.workspaceId, "VIEWER");
    return { workflow_run: toWorkflowRun(row) };
  }

  async start(input: {
    userId: string;
    workspaceId: string;
    workflowId: string;
    brief: string;
  }): Promise<{ workflow_run: WorkflowRun }> {
    const membership = await this.rbac.requireWorkspaceMember(
      input.userId,
      input.workspaceId,
      "EDITOR",
    );
    const definition = getWorkflowDefinitionById(input.workflowId);
    if (!definition) {
      throw new NotFoundException({ code: "not_found", message: `Unknown workflow: ${input.workflowId}` });
    }
    const brief = input.brief?.trim();
    if (!brief) {
      throw new BadRequestException({ code: "invalid_input", message: "brief required" });
    }

    const packagesSnapshot = await this.packages.assertWorkflowPackageInstalled(
      membership.organizationId,
      definition.id,
    );
    // Ensure specialists used by fan_out are installed.
    for (const step of definition.steps) {
      if (step.kind === "fan_out") {
        for (const agentId of step.targets ?? []) {
          await this.packages.assertAgentPackageInstalled(membership.organizationId, agentId);
        }
      }
      if (step.kind === "delegate" && step.agent) {
        await this.packages.assertAgentPackageInstalled(membership.organizationId, step.agent);
      }
    }

    const runId = randomUUID();
    const workflowRunId = randomUUID();
    const traceId = randomUUID();
    const budgetSnapshot = buildBudgetSnapshot({
      organization_id: membership.organizationId,
      workspace_id: input.workspaceId,
      run_id: runId,
    });

    const { workflowRow } = await this.prisma.$transaction(async (tx) => {
      const run = await tx.run.create({
        data: {
          id: runId,
          organizationId: membership.organizationId,
          workspaceId: input.workspaceId,
          createdByUserId: input.userId,
          status: "queued",
          metadata: asJson({
            workflow_id: definition.id,
            workflow_run_id: workflowRunId,
            budget_snapshot: budgetSnapshot,
            packages_snapshot: packagesSnapshot,
          }),
        },
      });
      await tx.runStep.create({
        data: {
          organizationId: membership.organizationId,
          runId: run.id,
          seq: 1,
          name: `${definition.id}.start`,
          kind: "workflow",
          agentId: "workflow-engine",
          status: "queued",
          input: asJson({ brief }),
        },
      });
      const workflowRow = await tx.workflowRunRow.create({
        data: {
          id: workflowRunId,
          organizationId: membership.organizationId,
          workspaceId: input.workspaceId,
          workflowId: definition.id,
          workflowVersion: definition.version,
          runId: run.id,
          status: "queued",
          definitionSnapshot: asJson(definition),
          completedStepIds: [],
          input: asJson({ brief }),
          createdByUserId: input.userId,
        },
      });
      return { workflowRow };
    });

    await this.bus.publish(
      {
        event_id: randomUUID(),
        correlation_id: traceId,
        causation_id: workflowRunId,
        tenant_id: membership.organizationId,
        workspace_id: input.workspaceId,
        run_id: runId,
        timestamp: new Date().toISOString(),
        version: "1",
        event_type: "workflow.start",
        payload: {
          action: "start",
          workflow_run_id: workflowRunId,
          organization_id: membership.organizationId,
          workspace_id: input.workspaceId,
          run_id: runId,
          trace_id: traceId,
          definition,
          input: { brief },
          budget_snapshot: budgetSnapshot,
          packages_snapshot: packagesSnapshot,
        },
      },
      { topic: WORKFLOW_TASKS_TOPIC },
    );

    await this.prisma.workflowRunRow.update({
      where: { id: workflowRunId },
      data: { status: "running", startedAt: new Date() },
    });

    const fresh = await this.prisma.workflowRunRow.findUniqueOrThrow({
      where: { id: workflowRunId },
    });
    return { workflow_run: toWorkflowRun(fresh) };
  }

  async resume(workflowRunId: string, userId: string): Promise<{ workflow_run: WorkflowRun }> {
    const row = await this.prisma.workflowRunRow.findUnique({ where: { id: workflowRunId } });
    if (!row) {
      throw new NotFoundException({ code: "not_found", message: "Workflow run not found" });
    }
    await this.rbac.requireWorkspaceMember(userId, row.workspaceId, "EDITOR");
    if (row.status !== "waiting_checkpoint" && row.status !== "paused") {
      throw new BadRequestException({
        code: "invalid_state",
        message: `Cannot resume workflow in status ${row.status}`,
      });
    }

    const definition = row.definitionSnapshot as unknown as WorkflowDefinition;
    const traceId = randomUUID();
    const input = (row.input as Record<string, unknown>) ?? {};

    await this.prisma.workflowRunRow.update({
      where: { id: workflowRunId },
      data: { status: "running" },
    });

    await this.bus.publish(
      {
        event_id: randomUUID(),
        correlation_id: traceId,
        causation_id: workflowRunId,
        tenant_id: row.organizationId,
        workspace_id: row.workspaceId,
        run_id: row.runId,
        timestamp: new Date().toISOString(),
        version: "1",
        event_type: "workflow.resume",
        payload: {
          action: "resume",
          workflow_run_id: workflowRunId,
          organization_id: row.organizationId,
          workspace_id: row.workspaceId,
          run_id: row.runId,
          trace_id: traceId,
          definition,
          input,
        },
      },
      { topic: WORKFLOW_TASKS_TOPIC },
    );

    const fresh = await this.prisma.workflowRunRow.findUniqueOrThrow({
      where: { id: workflowRunId },
    });
    return { workflow_run: toWorkflowRun(fresh) };
  }
}
