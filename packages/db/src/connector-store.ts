/**
 * Prisma connector metadata store (Phase 28a / ADR-013).
 * Structurally compatible with verse-core ConnectorStorePort — no Core import.
 */
import type { ConnectorProviderId } from "@at72-verse/contracts";
import type { PrismaClient } from "./client.js";

export type ConnectorConnectionRecord = {
  id: string;
  organization_id: string;
  workspace_id: string;
  provider: ConnectorProviderId;
  status: "pending" | "connected" | "revoked" | "error";
  vault_ref: string;
  external_account_hint: string | null;
  connected_at: string | null;
  revoked_at: string | null;
  updated_at: string;
};

export type ConnectorStorePort = {
  upsert(record: ConnectorConnectionRecord): Promise<ConnectorConnectionRecord>;
  getByWorkspaceProvider(
    workspace_id: string,
    provider: ConnectorProviderId,
  ): Promise<ConnectorConnectionRecord | null>;
  getById(id: string): Promise<ConnectorConnectionRecord | null>;
  listByWorkspace(workspace_id: string): Promise<ConnectorConnectionRecord[]>;
  delete(id: string): Promise<void>;
};

function rowToRecord(row: {
  id: string;
  organizationId: string;
  workspaceId: string;
  provider: string;
  status: string;
  vaultRef: string;
  externalAccountHint: string | null;
  connectedAt: Date | null;
  revokedAt: Date | null;
  updatedAt: Date;
}): ConnectorConnectionRecord {
  return {
    id: row.id,
    organization_id: row.organizationId,
    workspace_id: row.workspaceId,
    provider: row.provider as ConnectorProviderId,
    status: row.status as ConnectorConnectionRecord["status"],
    vault_ref: row.vaultRef,
    external_account_hint: row.externalAccountHint,
    connected_at: row.connectedAt ? row.connectedAt.toISOString() : null,
    revoked_at: row.revokedAt ? row.revokedAt.toISOString() : null,
    updated_at: row.updatedAt.toISOString(),
  };
}

export function createPrismaConnectorStore(prisma: PrismaClient): ConnectorStorePort {
  return {
    async upsert(record) {
      const row = await prisma.connectorConnectionRow.upsert({
        where: {
          workspaceId_provider: {
            workspaceId: record.workspace_id,
            provider: record.provider,
          },
        },
        create: {
          id: record.id,
          organizationId: record.organization_id,
          workspaceId: record.workspace_id,
          provider: record.provider,
          status: record.status,
          vaultRef: record.vault_ref,
          externalAccountHint: record.external_account_hint,
          connectedAt: record.connected_at ? new Date(record.connected_at) : null,
          revokedAt: record.revoked_at ? new Date(record.revoked_at) : null,
        },
        update: {
          status: record.status,
          vaultRef: record.vault_ref,
          externalAccountHint: record.external_account_hint,
          connectedAt: record.connected_at ? new Date(record.connected_at) : null,
          revokedAt: record.revoked_at ? new Date(record.revoked_at) : null,
        },
      });
      return rowToRecord(row);
    },

    async getByWorkspaceProvider(workspace_id, provider) {
      const row = await prisma.connectorConnectionRow.findUnique({
        where: {
          workspaceId_provider: { workspaceId: workspace_id, provider },
        },
      });
      return row ? rowToRecord(row) : null;
    },

    async getById(id) {
      const row = await prisma.connectorConnectionRow.findUnique({ where: { id } });
      return row ? rowToRecord(row) : null;
    },

    async listByWorkspace(workspace_id) {
      const rows = await prisma.connectorConnectionRow.findMany({
        where: { workspaceId: workspace_id },
        orderBy: { provider: "asc" },
      });
      return rows.map(rowToRecord);
    },

    async delete(id) {
      await prisma.connectorConnectionRow.deleteMany({ where: { id } });
    },
  };
}
