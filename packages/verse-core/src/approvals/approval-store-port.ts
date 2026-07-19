/**
 * HITL approval persistence (Phase 29).
 * Rows never store OAuth tokens or vault material.
 */
import { randomUUID } from "node:crypto";
import type { ApprovalRequestPublic, ApprovalStatus } from "@at72-verse/contracts";

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
  input_preview: ApprovalRequestPublic["input_preview"];
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
  input_preview: ApprovalRequestPublic["input_preview"];
  /** Default 24h (DZ7-A). */
  ttl_ms?: number;
};

export type ApprovalStorePort = {
  createPending(input: CreateApprovalInput): Promise<ApprovalRequestRecord>;
  getById(id: string): Promise<ApprovalRequestRecord | null>;
  listByWorkspace(
    workspace_id: string,
    opts?: { status?: ApprovalStatus },
  ): Promise<ApprovalRequestRecord[]>;
  /** Atomic pending → approved. Returns null if lost the race or not pending. */
  tryApprove(id: string, decided_by_user_id: string): Promise<ApprovalRequestRecord | null>;
  /** Atomic pending → rejected. */
  tryReject(id: string, decided_by_user_id: string): Promise<ApprovalRequestRecord | null>;
  /**
   * Atomic approved → executed (single-flight before side-effect).
   * Losers get null → APPROVAL_ALREADY_CONSUMED.
   */
  tryClaimExecution(id: string): Promise<ApprovalRequestRecord | null>;
  /** Mark pending rows past expires_at as expired. */
  expireDue(now?: Date): Promise<number>;
};

export function toPublicApproval(record: ApprovalRequestRecord): ApprovalRequestPublic {
  return {
    id: record.id,
    organization_id: record.organization_id,
    workspace_id: record.workspace_id,
    run_id: record.run_id,
    step_id: record.step_id,
    tool_id: record.tool_id,
    agent_id: record.agent_id,
    status: record.status,
    input_preview: record.input_preview,
    expires_at: record.expires_at,
    decided_at: record.decided_at,
    executed_at: record.executed_at,
    created_at: record.created_at,
    updated_at: record.updated_at,
  };
}

/** Redacted preview for inbox (DZ8) — never secrets. */
export function buildApprovalInputPreview(
  input: Record<string, unknown>,
): ApprovalRequestPublic["input_preview"] {
  const content = typeof input.content === "string" ? input.content : undefined;
  const preview =
    content === undefined
      ? undefined
      : content.length <= 160
        ? content
        : `${content.slice(0, 160)}…`;
  return {
    ...(typeof input.platform === "string" ? { platform: input.platform } : {}),
    ...(typeof input.mode === "string" ? { mode: input.mode } : {}),
    ...(preview !== undefined ? { content_preview: preview } : {}),
  };
}

export class InMemoryApprovalStore implements ApprovalStorePort {
  private readonly byId = new Map<string, ApprovalRequestRecord>();

  async createPending(input: CreateApprovalInput): Promise<ApprovalRequestRecord> {
    const now = new Date();
    const ttl = input.ttl_ms ?? DEFAULT_APPROVAL_TTL_MS;
    const record: ApprovalRequestRecord = {
      id: randomUUID(),
      organization_id: input.organization_id,
      workspace_id: input.workspace_id,
      run_id: input.run_id,
      step_id: input.step_id ?? null,
      tool_id: input.tool_id,
      agent_id: input.agent_id,
      status: "pending",
      input_snapshot: { ...input.input_snapshot },
      input_preview: { ...input.input_preview },
      expires_at: new Date(now.getTime() + ttl).toISOString(),
      decided_by_user_id: null,
      decided_at: null,
      executed_at: null,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    this.byId.set(record.id, record);
    return { ...record, input_snapshot: { ...record.input_snapshot } };
  }

  async getById(id: string): Promise<ApprovalRequestRecord | null> {
    const row = this.byId.get(id);
    return row ? clone(row) : null;
  }

  async listByWorkspace(
    workspace_id: string,
    opts?: { status?: ApprovalStatus },
  ): Promise<ApprovalRequestRecord[]> {
    await this.expireDue();
    return [...this.byId.values()]
      .filter((r) => r.workspace_id === workspace_id)
      .filter((r) => (opts?.status ? r.status === opts.status : true))
      .map(clone)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
  }

  async tryApprove(id: string, decided_by_user_id: string): Promise<ApprovalRequestRecord | null> {
    await this.expireDue();
    const row = this.byId.get(id);
    if (!row || row.status !== "pending") return null;
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      row.status = "expired";
      row.updated_at = new Date().toISOString();
      return null;
    }
    const now = new Date().toISOString();
    row.status = "approved";
    row.decided_by_user_id = decided_by_user_id;
    row.decided_at = now;
    row.updated_at = now;
    return clone(row);
  }

  async tryReject(id: string, decided_by_user_id: string): Promise<ApprovalRequestRecord | null> {
    await this.expireDue();
    const row = this.byId.get(id);
    if (!row || row.status !== "pending") return null;
    const now = new Date().toISOString();
    row.status = "rejected";
    row.decided_by_user_id = decided_by_user_id;
    row.decided_at = now;
    row.updated_at = now;
    return clone(row);
  }

  async tryClaimExecution(id: string): Promise<ApprovalRequestRecord | null> {
    const row = this.byId.get(id);
    if (!row || row.status !== "approved" || row.executed_at) return null;
    const now = new Date().toISOString();
    row.status = "executed";
    row.executed_at = now;
    row.updated_at = now;
    return clone(row);
  }

  async expireDue(now = new Date()): Promise<number> {
    let n = 0;
    const ts = now.toISOString();
    for (const row of this.byId.values()) {
      if (row.status === "pending" && new Date(row.expires_at).getTime() <= now.getTime()) {
        row.status = "expired";
        row.updated_at = ts;
        n += 1;
      }
    }
    return n;
  }
}

function clone(row: ApprovalRequestRecord): ApprovalRequestRecord {
  return {
    ...row,
    input_snapshot: { ...row.input_snapshot },
    input_preview: { ...row.input_preview },
  };
}
