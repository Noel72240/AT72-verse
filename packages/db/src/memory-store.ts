/**
 * Prisma-backed memory persistence (Phase 18 / DL1 · Phase 25 L4).
 * Structurally compatible with verse-core MemoryStorePort — no Core import (layering).
 */
import type { MemoryLayer, MemoryRecord, MemoryRecordType } from "@at72-verse/contracts";
import type { PrismaClient } from "./client.js";

export type MemoryRecordQuery = {
  organization_id: string;
  workspace_id?: string;
  scope?: string;
  layer?: MemoryLayer;
  run_id?: string | null;
  conversation_id?: string | null;
  user_id?: string | null;
  query: string;
  limit: number;
  exclude_deleted?: boolean;
};

export type MemoryRecordRepository = {
  insert(record: MemoryRecord): Promise<MemoryRecord>;
  query(filter: MemoryRecordQuery): Promise<MemoryRecord[]>;
  getById(id: string, organizationId: string): Promise<MemoryRecord | null>;
  setPinned(id: string, organizationId: string, pinned: boolean): Promise<MemoryRecord>;
  softDelete(id: string, organizationId: string): Promise<void>;
};

function toContract(row: {
  id: string;
  organizationId: string;
  workspaceId: string;
  runId: string | null;
  conversationId: string | null;
  userId: string | null;
  agentId: string | null;
  traceId: string | null;
  scope: string;
  layer: string;
  type: string;
  content: string;
  pinned: boolean;
  deletedAt: Date | null;
  createdAt: Date;
}): MemoryRecord {
  return {
    id: row.id,
    organization_id: row.organizationId,
    workspace_id: row.workspaceId,
    run_id: row.runId,
    conversation_id: row.conversationId,
    user_id: row.userId,
    agent_id: row.agentId,
    trace_id: row.traceId,
    scope: row.scope,
    layer: row.layer as MemoryLayer,
    type: row.type as MemoryRecordType,
    content: row.content,
    created_at: row.createdAt.toISOString(),
    pinned: row.pinned,
    deleted_at: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

export function createPrismaMemoryStore(prisma: PrismaClient): MemoryRecordRepository {
  return {
    async insert(record: MemoryRecord): Promise<MemoryRecord> {
      const row = await prisma.memoryRecordRow.create({
        data: {
          id: record.id,
          organizationId: record.organization_id,
          workspaceId: record.workspace_id,
          runId: record.run_id,
          conversationId: record.conversation_id,
          userId: record.user_id,
          agentId: record.agent_id,
          traceId: record.trace_id,
          scope: record.scope,
          layer: record.layer,
          type: record.type,
          content: record.content,
          pinned: record.pinned ?? false,
          deletedAt: record.deleted_at ? new Date(record.deleted_at) : null,
          createdAt: new Date(record.created_at),
        },
      });
      return toContract(row);
    },

    async query(filter: MemoryRecordQuery): Promise<MemoryRecord[]> {
      const excludeDeleted = filter.exclude_deleted !== false;
      const rows = await prisma.memoryRecordRow.findMany({
        where: {
          organizationId: filter.organization_id,
          ...(excludeDeleted ? { deletedAt: null } : {}),
          ...(filter.workspace_id ? { workspaceId: filter.workspace_id } : {}),
          ...(filter.scope ? { scope: filter.scope } : {}),
          ...(filter.layer ? { layer: filter.layer } : {}),
          ...(filter.run_id !== undefined && filter.run_id !== null
            ? { runId: filter.run_id }
            : {}),
          ...(filter.conversation_id !== undefined && filter.conversation_id !== null
            ? { conversationId: filter.conversation_id }
            : {}),
          ...(filter.user_id !== undefined
            ? filter.user_id === null
              ? { userId: null }
              : { userId: filter.user_id }
            : {}),
          ...(filter.query
            ? { content: { contains: filter.query, mode: "insensitive" } }
            : {}),
        },
        orderBy: [{ pinned: "desc" }, { createdAt: "asc" }, { id: "asc" }],
        take: filter.limit,
      });
      return rows.map(toContract);
    },

    async getById(id: string, organizationId: string): Promise<MemoryRecord | null> {
      const row = await prisma.memoryRecordRow.findFirst({
        where: { id, organizationId },
      });
      return row ? toContract(row) : null;
    },

    async setPinned(id: string, organizationId: string, pinned: boolean): Promise<MemoryRecord> {
      const existing = await prisma.memoryRecordRow.findFirst({
        where: { id, organizationId, deletedAt: null },
      });
      if (!existing) {
        throw new Error(`Memory record not found: ${id}`);
      }
      const row = await prisma.memoryRecordRow.update({
        where: { id },
        data: { pinned },
      });
      return toContract(row);
    },

    async softDelete(id: string, organizationId: string): Promise<void> {
      const existing = await prisma.memoryRecordRow.findFirst({
        where: { id, organizationId },
      });
      if (!existing) {
        throw new Error(`Memory record not found: ${id}`);
      }
      await prisma.memoryRecordRow.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    },
  };
}
