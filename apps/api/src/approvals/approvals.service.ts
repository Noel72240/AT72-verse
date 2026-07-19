import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { ApprovalRequestPublic, ApprovalResumePayload } from "@at72-verse/contracts";
import { approvalsResumeTopic, type Bus } from "@at72-verse/bus";
import {
  createPrismaApprovalStore,
  createPrismaConnectorStore,
  createPrismaSecretsVaultCipherStore,
  type PrismaClient,
} from "@at72-verse/db";
import {
  LocalEncryptedSecretsVault,
  toPublicApproval,
  type VerseCore,
} from "@at72-verse/verse-core";
import { PRISMA } from "../auth/auth.tokens.js";
import { BUS } from "../core/bus.tokens.js";
import { VERSE_CORE } from "../core/core.tokens.js";
import { GrantsService } from "../grants/grants.service.js";
import { RbacService } from "../rbac/rbac.service.js";
import { publishRunEvent } from "../runs/runs.events.js";
import { toContractRun } from "../runs/runs.mappers.js";

@Injectable()
export class ApprovalsService implements OnModuleInit {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(VERSE_CORE) private readonly core: VerseCore,
    @Inject(BUS) private readonly bus: Bus,
    private readonly rbac: RbacService,
    private readonly grants: GrantsService,
  ) {}

  onModuleInit(): void {
    const cipherStore = createPrismaSecretsVaultCipherStore(this.prisma);
    const vault = new LocalEncryptedSecretsVault({ store: cipherStore });
    const connectorStore = createPrismaConnectorStore(this.prisma);
    const approvalStore = createPrismaApprovalStore(this.prisma);
    this.core.setSecretsVault(vault);
    this.core.setConnectorStore(connectorStore);
    this.core.setApprovalStore(approvalStore);
  }

  async list(
    workspaceId: string,
    userId: string,
    status?: string,
  ): Promise<{ approvals: ApprovalRequestPublic[] }> {
    await this.workspaceOrThrow(workspaceId);
    await this.rbac.requireWorkspaceMember(userId, workspaceId, "VIEWER");
    await this.core.getApprovalStore().expireDue();
    const rows = await this.core.getApprovalStore().listByWorkspace(workspaceId, {
      status: status as ApprovalRequestPublic["status"] | undefined,
    });
    return { approvals: rows.map(toPublicApproval) };
  }

  async approve(
    runId: string,
    userId: string,
    approvalId: string,
  ): Promise<{ approval: ApprovalRequestPublic }> {
    if (!approvalId?.trim()) {
      throw new BadRequestException({ code: "invalid_input", message: "approval_id required" });
    }
    const run = await this.prisma.run.findUnique({ where: { id: runId } });
    if (!run) {
      throw new NotFoundException({ code: "not_found", message: "Run not found" });
    }
    await this.rbac.requireWorkspaceMember(userId, run.workspaceId, "ADMIN");

    const store = this.core.getApprovalStore();
    const existing = await store.getById(approvalId);
    if (!existing || existing.run_id !== runId) {
      throw new NotFoundException({ code: "not_found", message: "Approval not found for run" });
    }

    const approved = await store.tryApprove(approvalId, userId);
    if (!approved) {
      const again = await store.getById(approvalId);
      if (again?.status === "approved" || again?.status === "executed") {
        return { approval: toPublicApproval(again) };
      }
      throw new ConflictException({
        code: "approval_not_pending",
        message: "Approval is not pending (expired, rejected, or already decided)",
      });
    }

    if (run.status === "waiting_approval") {
      const updated = await this.prisma.run.update({
        where: { id: run.id },
        data: { status: "running" },
      });
      if (approved.step_id) {
        await this.prisma.runStep.updateMany({
          where: { id: approved.step_id, runId: run.id },
          data: { status: "running" },
        });
      }
      await publishRunEvent(this.bus, "status_changed", toContractRun(updated), {
        from: "waiting_approval",
        to: "running",
        approval_id: approvalId,
      });
    }

    const grantsSnapshot = await this.grants.snapshotForWorkspace(
      run.organizationId,
      run.workspaceId,
    );
    const resume: ApprovalResumePayload = {
      approval_id: approved.id,
      organization_id: approved.organization_id,
      workspace_id: approved.workspace_id,
      run_id: approved.run_id,
      step_id: approved.step_id,
      tool_id: approved.tool_id,
      agent_id: approved.agent_id,
      input: approved.input_snapshot,
      trace_id: randomUUID(),
      grants_snapshot: grantsSnapshot,
      tools_allowlist: [approved.tool_id],
    };
    await this.bus.publish(
      {
        event_id: randomUUID(),
        correlation_id: resume.trace_id,
        causation_id: approvalId,
        tenant_id: approved.organization_id,
        workspace_id: approved.workspace_id,
        run_id: approved.run_id,
        timestamp: new Date().toISOString(),
        version: "1",
        event_type: "approval.resume",
        payload: { ...resume },
      },
      { topic: approvalsResumeTopic() },
    );

    return { approval: toPublicApproval(approved) };
  }

  async reject(
    runId: string,
    userId: string,
    approvalId: string,
  ): Promise<{ approval: ApprovalRequestPublic }> {
    if (!approvalId?.trim()) {
      throw new BadRequestException({ code: "invalid_input", message: "approval_id required" });
    }
    const run = await this.prisma.run.findUnique({ where: { id: runId } });
    if (!run) {
      throw new NotFoundException({ code: "not_found", message: "Run not found" });
    }
    await this.rbac.requireWorkspaceMember(userId, run.workspaceId, "ADMIN");

    const store = this.core.getApprovalStore();
    const existing = await store.getById(approvalId);
    if (!existing || existing.run_id !== runId) {
      throw new NotFoundException({ code: "not_found", message: "Approval not found for run" });
    }

    const rejected = await store.tryReject(approvalId, userId);
    if (!rejected) {
      throw new ConflictException({
        code: "approval_not_pending",
        message: "Approval is not pending",
      });
    }

    if (run.status === "waiting_approval" || run.status === "running" || run.status === "queued") {
      const updated = await this.prisma.run.update({
        where: { id: run.id },
        data: {
          status: "failed",
          completedAt: new Date(),
          error: {
            message: "Approval rejected",
            approval_id: approvalId,
          },
        },
      });
      if (rejected.step_id) {
        await this.prisma.runStep.updateMany({
          where: { id: rejected.step_id, runId: run.id },
          data: {
            status: "failed",
            output: {
              error: "Approval rejected",
              approval_id: approvalId,
            },
          },
        });
      }
      await publishRunEvent(this.bus, "status_changed", toContractRun(updated), {
        from: run.status,
        to: "failed",
        approval_id: approvalId,
        reason: "rejected",
      });
    }

    return { approval: toPublicApproval(rejected) };
  }

  private async workspaceOrThrow(workspaceId: string) {
    const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!ws) {
      throw new NotFoundException({ code: "not_found", message: "Workspace not found" });
    }
    return ws;
  }
}
