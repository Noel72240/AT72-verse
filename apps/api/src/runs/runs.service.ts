import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Bus } from "@at72-verse/bus";
import {
  canTransitionRunStatus,
  type BudgetSnapshot,
  type RunCostSummary,
  type RunStatus,
} from "@at72-verse/contracts";
import type { PrismaClient, Prisma } from "@at72-verse/db";
import { getMetrics } from "@at72-verse/observability";
import { buildBudgetSnapshot } from "@at72-verse/verse-core";
import { PRISMA } from "../auth/auth.tokens.js";
import { BUS } from "../core/bus.tokens.js";
import { GrantsService } from "../grants/grants.service.js";
import { PackagesService } from "../packages/packages.service.js";
import { PersonaService } from "../persona/persona.service.js";
import { QuotasService } from "../quotas/quotas.service.js";
import { RbacService } from "../rbac/rbac.service.js";
import { dispatchAgentTask } from "./runs.dispatch.js";
import { publishRunEvent } from "./runs.events.js";
import {
  toContractConversation,
  toContractMessage,
  toContractRun,
  toContractRunStep,
} from "./runs.mappers.js";
import type {
  AgentTaskCompletedPayload,
  AgentTaskConsultedPayload,
  AgentTaskDelegatedPayload,
} from "@at72-verse/contracts";

function asJson(
  value: Record<string, unknown> | null | undefined,
): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return value as Prisma.InputJsonValue;
}

export type CreateConversationInput = {
  workspaceId: string;
  userId: string;
  title?: string;
};

export type CreateMessageInput = {
  conversationId: string;
  userId: string;
  role?: "user" | "assistant" | "system";
  content: string;
};

export type CreateRunInput = {
  workspaceId: string;
  userId: string;
  conversationId?: string | null;
  metadata?: Record<string, unknown> | null;
  /** When set (e.g. "adam"), dispatch to verse.agent.{id}.tasks (AJ1). */
  targetAgent?: string | null;
  goal?: string;
  /** Optional run budget override (Phase 21 / DO5). */
  budget?: { max_usd?: number; max_tokens?: number } | null;
  initialStep?: {
    name?: string;
    kind?: string;
    agentId?: string | null;
    input?: Record<string, unknown> | null;
  };
};

export type CreateRunStepInput = {
  runId: string;
  userId: string;
  name: string;
  kind?: string;
  agentId?: string | null;
  parentStepId?: string | null;
  input?: Record<string, unknown> | null;
};

export type PatchRunStatusInput = {
  runId: string;
  userId: string;
  status: RunStatus;
  error?: Record<string, unknown> | null;
};

@Injectable()
export class RunsService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(BUS) private readonly bus: Bus,
    @Inject(RbacService) private readonly rbac: RbacService,
    @Inject(PersonaService) private readonly personas: PersonaService,
    @Inject(GrantsService) private readonly grants: GrantsService,
    @Inject(PackagesService) private readonly packages: PackagesService,
    @Inject(QuotasService) private readonly quotas: QuotasService,
  ) {}

  async createConversation(input: CreateConversationInput) {
    const membership = await this.rbac.requireWorkspaceMember(
      input.userId,
      input.workspaceId,
      "EDITOR",
    );
    const row = await this.prisma.conversation.create({
      data: {
        organizationId: membership.organizationId,
        workspaceId: input.workspaceId,
        createdByUserId: input.userId,
        title: input.title?.trim() || null,
      },
    });
    return toContractConversation(row);
  }

  async getConversation(conversationId: string, userId: string) {
    const row = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!row) {
      throw new NotFoundException({ code: "not_found", message: "Conversation not found" });
    }
    await this.rbac.requireWorkspaceMember(userId, row.workspaceId, "VIEWER");
    return toContractConversation(row);
  }

  async listConversations(workspaceId: string, userId: string) {
    await this.rbac.requireWorkspaceMember(userId, workspaceId, "VIEWER");
    const rows = await this.prisma.conversation.findMany({
      where: { workspaceId },
      orderBy: { updatedAt: "desc" },
    });
    return rows.map(toContractConversation);
  }

  async listMessages(conversationId: string, userId: string) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new NotFoundException({ code: "not_found", message: "Conversation not found" });
    }
    await this.rbac.requireWorkspaceMember(userId, conversation.workspaceId, "VIEWER");
    const rows = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });
    return rows.map(toContractMessage);
  }

  async createMessage(input: CreateMessageInput) {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: input.conversationId },
    });
    if (!conversation) {
      throw new NotFoundException({ code: "not_found", message: "Conversation not found" });
    }
    await this.rbac.requireWorkspaceMember(input.userId, conversation.workspaceId, "EDITOR");
    const content = input.content.trim();
    if (!content) {
      throw new BadRequestException({
        code: "invalid_input",
        message: "content is required",
      });
    }
    const role = input.role ?? "user";
    const row = await this.prisma.message.create({
      data: {
        organizationId: conversation.organizationId,
        conversationId: conversation.id,
        role,
        content,
      },
    });
    return toContractMessage(row);
  }

  async createRun(input: CreateRunInput) {
    const membership = await this.rbac.requireWorkspaceMember(
      input.userId,
      input.workspaceId,
      "EDITOR",
    );

    await this.quotas.assertCanCreateRun(membership.organizationId);

    if (input.conversationId) {
      const conversation = await this.prisma.conversation.findUnique({
        where: { id: input.conversationId },
      });
      if (!conversation || conversation.workspaceId !== input.workspaceId) {
        throw new BadRequestException({
          code: "invalid_input",
          message: "conversation_id must belong to the same workspace",
        });
      }
    }

    const targetAgent = input.targetAgent?.trim() || null;
    const stepName =
      input.initialStep?.name?.trim() || (targetAgent ? `${targetAgent}.orchestrate` : "bootstrap");
    const stepKind = input.initialStep?.kind?.trim() || (targetAgent ? "agent" : "manual");
    const stepAgentId = input.initialStep?.agentId ?? targetAgent;

    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: input.workspaceId },
    });
    const maxUsd =
      input.budget?.max_usd ??
      (workspace.defaultRunBudgetMaxUsd != null
        ? Number(workspace.defaultRunBudgetMaxUsd)
        : undefined);
    const maxTokens =
      input.budget?.max_tokens ?? workspace.defaultRunBudgetMaxTokens ?? undefined;

    // Pre-allocate run id for budget_snapshot.run_id (frozen at create).
    const runId = randomUUID();
    const budgetSnapshot = buildBudgetSnapshot({
      organization_id: membership.organizationId,
      workspace_id: input.workspaceId,
      run_id: runId,
      max_usd: maxUsd,
      max_tokens: maxTokens,
    });

    const { run, step } = await this.prisma.$transaction(async (tx) => {
      const run = await tx.run.create({
        data: {
          id: runId,
          organizationId: membership.organizationId,
          workspaceId: input.workspaceId,
          conversationId: input.conversationId ?? null,
          createdByUserId: input.userId,
          status: "queued",
          metadata: asJson({
            ...(input.metadata ?? {}),
            ...(targetAgent ? { target_agent: targetAgent } : {}),
            budget_snapshot: budgetSnapshot,
          }),
        },
      });
      const step = await tx.runStep.create({
        data: {
          organizationId: membership.organizationId,
          runId: run.id,
          seq: 1,
          name: stepName,
          kind: stepKind,
          agentId: stepAgentId,
          input: asJson(input.initialStep?.input ?? undefined),
          status: "queued",
        },
      });
      return { run, step };
    });

    const contractRun = toContractRun(run);
    const contractStep = toContractRunStep(step);
    await publishRunEvent(this.bus, "created", contractRun, {
      step: contractStep,
    });

    if (targetAgent) {
      // DN7 — refuse disabled agents before Runtime handleTask (snapshot frozen at dispatch).
      const grantsSnapshot = await this.grants.assertAgentEnabled(
        membership.organizationId,
        input.workspaceId,
        targetAgent,
      );
      // DP9 — refuse agents whose package is not installed for the org.
      const packagesSnapshot = await this.packages.assertAgentPackageInstalled(
        membership.organizationId,
        targetAgent,
      );
      const overrides = await this.personas.loadOverridesForAgent(
        membership.organizationId,
        input.workspaceId,
        targetAgent,
      );
      await dispatchAgentTask(this.bus, {
        agentId: targetAgent,
        run: contractRun,
        step: contractStep,
        goal: input.goal,
        personaOrgOverride: overrides.organization,
        personaWorkspaceOverride: overrides.workspace,
        grantsSnapshot,
        budgetSnapshot,
        packagesSnapshot,
      }).then(async (traceId) => {
        await this.prisma.run.update({
          where: { id: run.id },
          data: {
            metadata: asJson({
              ...((run.metadata as Record<string, unknown> | null) ?? {}),
              target_agent: targetAgent,
              budget_snapshot: budgetSnapshot,
              trace_id: traceId,
            }),
          },
        });
        getMetrics().runStatus.inc({ status: "queued", from: "create" });
      });
    }

    const refreshed = await this.prisma.run.findUniqueOrThrow({ where: { id: run.id } });
    return {
      run: toContractRun(refreshed),
      steps: [contractStep],
    };
  }

  async getRunCost(runId: string, userId: string): Promise<RunCostSummary> {
    const run = await this.prisma.run.findUnique({ where: { id: runId } });
    if (!run) {
      throw new NotFoundException({ code: "not_found", message: "Run not found" });
    }
    await this.rbac.requireWorkspaceMember(userId, run.workspaceId, "VIEWER");

    const meta = (run.metadata as Record<string, unknown> | null) ?? {};
    const snapshot = meta.budget_snapshot as BudgetSnapshot | undefined;

    const rows = await this.prisma.llmUsage.findMany({
      where: { runId },
      select: {
        estimatedUsd: true,
        inputTokens: true,
        outputTokens: true,
        pricingVersion: true,
      },
    });

    let spentUsd = 0;
    let spentTokens = 0;
    let pricingVersion: string | null = snapshot?.pricing_version ?? null;
    for (const row of rows) {
      spentUsd += Number(row.estimatedUsd);
      spentTokens += row.inputTokens + row.outputTokens;
      if (!pricingVersion) pricingVersion = row.pricingVersion;
    }
    spentUsd = Number(spentUsd.toFixed(6));

    const maxUsd = snapshot?.max_usd ?? null;
    const maxTokens = snapshot?.max_tokens ?? null;

    return {
      run_id: runId,
      pricing_version: pricingVersion,
      max_usd: maxUsd,
      max_tokens: maxTokens,
      spent_usd: spentUsd,
      spent_tokens: spentTokens,
      remaining_usd: maxUsd == null ? null : Number(Math.max(0, maxUsd - spentUsd).toFixed(6)),
      remaining_tokens: maxTokens == null ? null : Math.max(0, maxTokens - spentTokens),
      call_count: rows.length,
    };
  }

  async getRun(runId: string, userId: string) {
    const run = await this.prisma.run.findUnique({ where: { id: runId } });
    if (!run) {
      throw new NotFoundException({ code: "not_found", message: "Run not found" });
    }
    await this.rbac.requireWorkspaceMember(userId, run.workspaceId, "VIEWER");
    return toContractRun(run);
  }

  async listSteps(runId: string, userId: string) {
    const run = await this.prisma.run.findUnique({ where: { id: runId } });
    if (!run) {
      throw new NotFoundException({ code: "not_found", message: "Run not found" });
    }
    await this.rbac.requireWorkspaceMember(userId, run.workspaceId, "VIEWER");
    const steps = await this.prisma.runStep.findMany({
      where: { runId },
      orderBy: { seq: "asc" },
    });
    return steps.map(toContractRunStep);
  }

  async createStep(input: CreateRunStepInput) {
    const run = await this.prisma.run.findUnique({ where: { id: input.runId } });
    if (!run) {
      throw new NotFoundException({ code: "not_found", message: "Run not found" });
    }
    await this.rbac.requireWorkspaceMember(input.userId, run.workspaceId, "EDITOR");

    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException({
        code: "invalid_input",
        message: "name is required",
      });
    }

    if (input.parentStepId) {
      const parent = await this.prisma.runStep.findUnique({
        where: { id: input.parentStepId },
      });
      if (!parent || parent.runId !== run.id) {
        throw new BadRequestException({
          code: "invalid_input",
          message: "parent_step_id must belong to the same run",
        });
      }
    }

    const agg = await this.prisma.runStep.aggregate({
      where: { runId: run.id },
      _max: { seq: true },
    });
    const seq = (agg._max.seq ?? 0) + 1;

    const step = await this.prisma.runStep.create({
      data: {
        organizationId: run.organizationId,
        runId: run.id,
        parentStepId: input.parentStepId ?? null,
        seq,
        name,
        kind: input.kind?.trim() || "manual",
        agentId: input.agentId ?? null,
        input: asJson(input.input ?? undefined),
        status: "queued",
      },
    });

    await publishRunEvent(this.bus, "step_created", toContractRun(run), {
      step: toContractRunStep(step),
    });

    return toContractRunStep(step);
  }

  /**
   * Technical demo/test endpoint (AF2) — controlled status transitions only (AD1).
   */
  async patchStatus(input: PatchRunStatusInput) {
    const run = await this.prisma.run.findUnique({ where: { id: input.runId } });
    if (!run) {
      throw new NotFoundException({ code: "not_found", message: "Run not found" });
    }
    await this.rbac.requireWorkspaceMember(input.userId, run.workspaceId, "EDITOR");

    const from = run.status as RunStatus;
    const to = input.status;
    if (!canTransitionRunStatus(from, to)) {
      throw new BadRequestException({
        code: "invalid_transition",
        message: `Cannot transition run status from ${from} to ${to}`,
        details: { from, to },
      });
    }

    const now = new Date();
    const data: Prisma.RunUpdateInput = {
      status: to,
    };

    if (to === "running" && !run.startedAt) {
      data.startedAt = now;
    }
    if (to === "completed" || to === "failed") {
      data.completedAt = now;
    }
    if (to === "failed") {
      data.error = asJson(input.error ?? { message: "failed" });
    }

    const updated = await this.prisma.run.update({
      where: { id: run.id },
      data,
    });

    const contractRun = toContractRun(updated);
    await publishRunEvent(this.bus, "status_changed", contractRun, {
      from,
      to,
    });
    getMetrics().runStatus.inc({ status: to, from });

    return contractRun;
  }

  /**
   * System projection from agent task.delegated (Phase 15).
   * Records the child step BEFORE the sub-agent executes.
   */
  async projectAgentTaskDelegated(payload: AgentTaskDelegatedPayload): Promise<void> {
    await this.projectChildAgentStep({
      run_id: payload.run_id,
      step_id: payload.step_id,
      parent_step_id: payload.parent_step_id,
      agent_id: payload.agent_id,
      name: `${payload.agent_id}.delegated`,
      kind: "agent",
      input: {
        task: payload.task,
        delegated_by: payload.delegated_by,
        trace_id: payload.trace_id,
      },
    });
  }

  /**
   * System projection from agent task.consulted (Phase 24 / DR6 · DR9).
   * Timeline sibling under the same parent_step_id as delegates.
   */
  async projectAgentTaskConsulted(payload: AgentTaskConsultedPayload): Promise<void> {
    await this.projectChildAgentStep({
      run_id: payload.run_id,
      step_id: payload.step_id,
      parent_step_id: payload.parent_step_id,
      agent_id: payload.agent_id,
      name: `${payload.agent_id}.consulted`,
      kind: "consult",
      input: {
        question: payload.question,
        consulted_by: payload.consulted_by,
        trace_id: payload.trace_id,
      },
    });
  }

  private async projectChildAgentStep(input: {
    run_id: string;
    step_id: string;
    parent_step_id: string | null;
    agent_id: string;
    name: string;
    kind: string;
    input: Record<string, unknown>;
  }): Promise<void> {
    const run = await this.prisma.run.findUnique({ where: { id: input.run_id } });
    if (!run) {
      throw new NotFoundException({ code: "not_found", message: "Run not found" });
    }

    const existing = await this.prisma.runStep.findUnique({ where: { id: input.step_id } });
    if (existing) {
      return;
    }

    let parentStepId = input.parent_step_id;
    if (parentStepId) {
      const parent = await this.prisma.runStep.findUnique({ where: { id: parentStepId } });
      if (!parent || parent.runId !== run.id) {
        parentStepId = null;
      }
    }

    const agg = await this.prisma.runStep.aggregate({
      where: { runId: run.id },
      _max: { seq: true },
    });
    const seq = (agg._max.seq ?? 0) + 1;

    let step;
    try {
      step = await this.prisma.runStep.create({
        data: {
          id: input.step_id,
          organizationId: run.organizationId,
          runId: run.id,
          parentStepId,
          seq,
          name: input.name,
          kind: input.kind,
          agentId: input.agent_id,
          input: asJson(input.input),
          status: "running",
        },
      });
    } catch (err) {
      // Embedded runtime may insert the same child step first (id or seq race).
      const raced = await this.prisma.runStep.findUnique({ where: { id: input.step_id } });
      if (
        raced &&
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code?: string }).code === "P2002"
      ) {
        step = raced;
      } else {
        throw err;
      }
    }

    let contractRun = toContractRun(run);
    if (run.status === "queued") {
      const updated = await this.prisma.run.update({
        where: { id: run.id },
        data: { status: "running", startedAt: run.startedAt ?? new Date() },
      });
      contractRun = toContractRun(updated);
      await publishRunEvent(this.bus, "status_changed", contractRun, {
        from: "queued",
        to: "running",
      });
    }

    await publishRunEvent(this.bus, "step_created", contractRun, {
      step: toContractRunStep(step),
    });
  }

  /**
   * System projection from agent task.completed (AI3 / AO1).
   * No user RBAC — bus consumer is the trusted writer.
   */
  async projectAgentTaskCompleted(payload: AgentTaskCompletedPayload): Promise<void> {
    const found = await this.prisma.run.findUnique({ where: { id: payload.run_id } });
    if (!found) {
      throw new NotFoundException({ code: "not_found", message: "Run not found" });
    }
    let run = found;

    let parentStep = payload.step_id
      ? await this.prisma.runStep.findUnique({ where: { id: payload.step_id } })
      : null;
    if (parentStep && parentStep.runId !== run.id) {
      parentStep = null;
    }
    if (!parentStep) {
      parentStep = await this.prisma.runStep.findFirst({
        where: { runId: run.id, agentId: payload.agent_id },
        orderBy: { seq: "asc" },
      });
    }
    if (!parentStep) {
      throw new NotFoundException({
        code: "not_found",
        message: "Parent agent step not found for projection",
      });
    }

    if (payload.status === "failed") {
      await this.prisma.runStep.update({
        where: { id: parentStep.id },
        data: {
          status: "failed",
          output: asJson({ error: payload.error ?? "agent failed" }),
        },
      });
      if (run.status === "queued" || run.status === "running" || run.status === "waiting_approval") {
        const updated = await this.prisma.run.update({
          where: { id: run.id },
          data: {
            status: "failed",
            completedAt: new Date(),
            error: asJson({ message: payload.error ?? "agent failed" }),
          },
        });
        await publishRunEvent(this.bus, "status_changed", toContractRun(updated), {
          from: run.status,
          to: "failed",
        });
        getMetrics().runStatus.inc({ status: "failed", from: run.status });
      }
      return;
    }

    if (payload.status === "waiting_approval") {
      await this.prisma.runStep.update({
        where: { id: parentStep.id },
        data: {
          status: "waiting_approval",
          output: asJson({
            approval_id: payload.approval_id ?? null,
            trace_id: payload.trace_id,
          }),
        },
      });
      if (run.status === "queued" || run.status === "running") {
        const updated = await this.prisma.run.update({
          where: { id: run.id },
          data: {
            status: "waiting_approval",
            startedAt: run.startedAt ?? new Date(),
          },
        });
        await publishRunEvent(this.bus, "status_changed", toContractRun(updated), {
          from: run.status,
          to: "waiting_approval",
          approval_id: payload.approval_id ?? null,
        });
        getMetrics().runStatus.inc({ status: "waiting_approval", from: run.status });
      }
      return;
    }

    const agg = await this.prisma.runStep.aggregate({
      where: { runId: run.id },
      _max: { seq: true },
    });
    let nextSeq = (agg._max.seq ?? 0) + 1;

    const createdSteps = await this.prisma.$transaction(async (tx) => {
      const steps = [];
      for (const spec of payload.plan.steps) {
        const row = await tx.runStep.create({
          data: {
            organizationId: run.organizationId,
            runId: run.id,
            parentStepId: parentStep!.id,
            seq: nextSeq,
            name: spec.name,
            kind: spec.kind,
            agentId: spec.agent_id ?? null,
            status: "queued",
          },
        });
        nextSeq += 1;
        steps.push(row);
      }
      await tx.runStep.update({
        where: { id: parentStep!.id },
        data: {
          status: "completed",
          output: asJson({
            plan: payload.plan,
            trace_id: payload.trace_id,
            ...(payload.result ? { result: payload.result } : {}),
            ...(payload.resolved_persona
              ? { resolved_persona: payload.resolved_persona }
              : {}),
          } as Record<string, unknown>),
        },
      });
      return steps;
    });

    let contractRun = toContractRun(run);
    if (run.status === "queued") {
      const updated = await this.prisma.run.update({
        where: { id: run.id },
        data: { status: "running", startedAt: run.startedAt ?? new Date() },
      });
      contractRun = toContractRun(updated);
      await publishRunEvent(this.bus, "status_changed", contractRun, {
        from: "queued",
        to: "running",
      });
      run = updated;
    }

    for (const row of createdSteps) {
      await publishRunEvent(this.bus, "step_created", contractRun, {
        step: toContractRunStep(row),
      });
    }

    // Root agent step completed successfully → finalize run + persist assistant message (CG1)
    const isRootStep = parentStep.parentStepId === null;
    if (
      isRootStep &&
      (run.status === "queued" || run.status === "running" || run.status === "waiting_approval")
    ) {
      const assistantText = extractAssistantContent(payload.result);
      let messagePayload: Record<string, unknown> | null = null;

      if (run.conversationId && assistantText) {
        const msg = await this.prisma.message.create({
          data: {
            organizationId: run.organizationId,
            conversationId: run.conversationId,
            role: "assistant",
            content: assistantText,
          },
        });
        messagePayload = toContractMessage(msg) as unknown as Record<string, unknown>;
        await this.prisma.conversation.update({
          where: { id: run.conversationId },
          data: { updatedAt: new Date() },
        });
      }

      const completed = await this.prisma.run.update({
        where: { id: run.id },
        data: {
          status: "completed",
          completedAt: new Date(),
        },
      });
      contractRun = toContractRun(completed);
      await publishRunEvent(this.bus, "status_changed", contractRun, {
        from: run.status === "queued" ? "running" : run.status,
        to: "completed",
        result: payload.result ?? null,
        message: messagePayload,
      });
      getMetrics().runStatus.inc({
        status: "completed",
        from: run.status === "queued" ? "running" : run.status,
      });
    }
  }
}

function extractAssistantContent(result?: Record<string, unknown>): string | null {
  if (!result) return null;
  if (typeof result.content === "string" && result.content.trim().length > 0) {
    return result.content.trim();
  }
  try {
    return JSON.stringify(result);
  } catch {
    return null;
  }
}
