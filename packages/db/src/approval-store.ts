/**
 * Prisma HITL approval store (Phase 29).
 * Structurally compatible with verse-core ApprovalStorePort — no Core import.
 */
import { randomUUID } from "node:crypto";
import type { ApprovalStatus } from "@at72-verse/contracts";
import type { Prisma, PrismaClient } from "./client.js";

export const DEFAULT_APPROVAL_TTL_MS = 24 * 60 * 60 * 1000;

export type ApprovalRequestRecord = {
  id: string;
  organization_id: string;
  workspace_id: string;
  run_id: string;
  step_id: string | null;
  tool_id: string;
  agent_id: string;
  status: ApprovalStatus;
  input_snapshot: Record<string, unknown>;
  input_preview: {
    platform?: string;
    mode?: string;
    content_preview?: string;
  };
  expires_at: string;
  decided_by_user_id: string | null;
  decided_at: string | null;
  executed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateApprovalInput = {
  organization_id: string;
  workspace_id: string;
  run_id: string;
  step_id?: string | null;
  tool_id: string;
  agent_id: string;
  input_snapshot: Record<string, unknown>;
  input_preview: ApprovalRequestRecord["input_preview"];
  ttl_ms?: number;
};

export type ApprovalStorePort = {
  createPending(input: CreateApprovalInput): Promise<ApprovalRequestRecord>;
  getById(id: string): Promise<ApprovalRequestRecord | null>;
  listByWorkspace(
    workspace_id: string,
    opts?: { status?: ApprovalStatus },
  ): Promise<ApprovalRequestRecord[]>;
  tryApprove(id: string, decided_by_user_id: string): Promise<ApprovalRequestRecord | null>;
  tryReject(id: string, decided_by_user_id: string): Promise<ApprovalRequestRecord | null>;
  tryClaimExecution(id: string): Promise<ApprovalRequestRecord | null>;
  expireDue(now?: Date): Promise<number>;
};

function asObject(value: Prisma.JsonValue): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function rowToRecord(row: {
  id: string;
  organizationId: string;
  workspaceId: string;
  runId: string;
  stepId: string | null;
  toolId: string;
  agentId: string;
  status: string;
  inputSnapshot: Prisma.JsonValue;
  inputPreview: Prisma.JsonValue;
  expiresAt: Date;
  decidedByUserId: string | null;
  decidedAt: Date | null;
  executedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ApprovalRequestRecord {
  const preview = asObject(row.inputPreview);
  return {
    id: row.id,
    organization_id: row.organizationId,
    workspace_id: row.workspaceId,
    run_id: row.runId,
    step_id: row.stepId,
    tool_id: row.toolId,
    agent_id: row.agentId,
    status: row.status as ApprovalStatus,
    input_snapshot: asObject(row.inputSnapshot),
    input_preview: {
      ...(typeof preview.platform === "string" ? { platform: preview.platform } : {}),
      ...(typeof preview.mode === "string" ? { mode: preview.mode } : {}),
      ...(typeof preview.content_preview === "string"
        ? { content_preview: preview.content_preview }
        : {}),
    },
    expires_at: row.expiresAt.toISOString(),
    decided_by_user_id: row.decidedByUserId,
    decided_at: row.decidedAt ? row.decidedAt.toISOString() : null,
    executed_at: row.executedAt ? row.executedAt.toISOString() : null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function createPrismaApprovalStore(prisma: PrismaClient): ApprovalStorePort {
  return {
    async createPending(input) {
      const now = new Date();
      const ttl = input.ttl_ms ?? DEFAULT_APPROVAL_TTL_MS;
      const row = await prisma.approvalRequestRow.create({
        data: {
          id: randomUUID(),
          organizationId: input.organization_id,
          workspaceId: input.workspace_id,
          runId: input.run_id,
          stepId: input.step_id ?? null,
          toolId: input.tool_id,
          agentId: input.agent_id,
          status: "pending",
          inputSnapshot: input.input_snapshot as Prisma.InputJsonValue,
          inputPreview: input.input_preview as Prisma.InputJsonValue,
          expiresAt: new Date(now.getTime() + ttl),
        },
      });
      return rowToRecord(row);
    },

    async getById(id) {
      const row = await prisma.approvalRequestRow.findUnique({ where: { id } });
      return row ? rowToRecord(row) : null;
    },

    async listByWorkspace(workspace_id, opts) {
      await this.expireDue();
      const rows = await prisma.approvalRequestRow.findMany({
        where: {
          workspaceId: workspace_id,
          ...(opts?.status ? { status: opts.status } : {}),
        },
        orderBy: { createdAt: "asc" },
      });
      return rows.map(rowToRecord);
    },

    async tryApprove(id, decided_by_user_id) {
      await this.expireDue();
      const now = new Date();
      const result = await prisma.approvalRequestRow.updateMany({
        where: {
          id,
          status: "pending",
          expiresAt: { gt: now },
        },
        data: {
          status: "approved",
          decidedByUserId: decided_by_user_id,
          decidedAt: now,
        },
      });
      if (result.count !== 1) return null;
      const row = await prisma.approvalRequestRow.findUnique({ where: { id } });
      return row ? rowToRecord(row) : null;
    },

    async tryReject(id, decided_by_user_id) {
      await this.expireDue();
      const now = new Date();
      const result = await prisma.approvalRequestRow.updateMany({
        where: { id, status: "pending" },
        data: {
          status: "rejected",
          decidedByUserId: decided_by_user_id,
          decidedAt: now,
        },
      });
      if (result.count !== 1) return null;
      const row = await prisma.approvalRequestRow.findUnique({ where: { id } });
      return row ? rowToRecord(row) : null;
    },

    async tryClaimExecution(id) {
      const now = new Date();
      const result = await prisma.approvalRequestRow.updateMany({
        where: {
          id,
          status: "approved",
          executedAt: null,
        },
        data: {
          status: "executed",
          executedAt: now,
        },
      });
      if (result.count !== 1) return null;
      const row = await prisma.approvalRequestRow.findUnique({ where: { id } });
      return row ? rowToRecord(row) : null;
    },

    async expireDue(now = new Date()) {
      const result = await prisma.approvalRequestRow.updateMany({
        where: {
          status: "pending",
          expiresAt: { lte: now },
        },
        data: { status: "expired" },
      });
      return result.count;
    },
  };
}
