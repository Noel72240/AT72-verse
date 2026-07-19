/**
 * Connector connection metadata only (Phase 28a / ADR-013).
 * Never includes tokens, codes, state, or client secrets.
 */
export type ConnectorProviderId = "linkedin";

export type ConnectorConnectionStatus =
  | "pending"
  | "connected"
  | "revoked"
  | "error";

/** Public DTO — safe for API / UI. Forbidden fields: any OAuth secret material. */
export type ConnectorConnectionPublic = {
  id: string;
  organization_id: string;
  workspace_id: string;
  provider: ConnectorProviderId;
  status: ConnectorConnectionStatus;
  /** Non-secret display hint (e.g. LinkedIn member id), never a token. */
  external_account_hint: string | null;
  connected_at: string | null;
  revoked_at: string | null;
  updated_at: string;
};
