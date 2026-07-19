import type {
  ConnectorConnectionPublic,
  ConnectorConnectionStatus,
  ConnectorProviderId,
} from "@at72-verse/contracts";

export type ConnectorConnectionRecord = {
  id: string;
  organization_id: string;
  workspace_id: string;
  provider: ConnectorProviderId;
  status: ConnectorConnectionStatus;
  /** Vault ref for encrypted token payload — never expose outside Core. */
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

export function toPublicConnection(record: ConnectorConnectionRecord): ConnectorConnectionPublic {
  return {
    id: record.id,
    organization_id: record.organization_id,
    workspace_id: record.workspace_id,
    provider: record.provider,
    status: record.status,
    external_account_hint: record.external_account_hint,
    connected_at: record.connected_at,
    revoked_at: record.revoked_at,
    updated_at: record.updated_at,
  };
}

export class InMemoryConnectorStore implements ConnectorStorePort {
  private readonly byId = new Map<string, ConnectorConnectionRecord>();

  async upsert(record: ConnectorConnectionRecord): Promise<ConnectorConnectionRecord> {
    this.byId.set(record.id, record);
    return record;
  }

  async getByWorkspaceProvider(
    workspace_id: string,
    provider: ConnectorProviderId,
  ): Promise<ConnectorConnectionRecord | null> {
    for (const row of this.byId.values()) {
      if (row.workspace_id === workspace_id && row.provider === provider) return row;
    }
    return null;
  }

  async getById(id: string): Promise<ConnectorConnectionRecord | null> {
    return this.byId.get(id) ?? null;
  }

  async listByWorkspace(workspace_id: string): Promise<ConnectorConnectionRecord[]> {
    return [...this.byId.values()].filter((r) => r.workspace_id === workspace_id);
  }

  async delete(id: string): Promise<void> {
    this.byId.delete(id);
  }
}
