/**
 * Load capability grants for a workspace (Phase 20 / DN3).
 */
import type { CapabilityKind, PermissionGrant } from "@at72-verse/contracts";

export type CapabilityGrantPort = {
  list(organizationId: string, workspaceId: string): Promise<PermissionGrant[]>;
};

export type CapabilityGrantUpsert = {
  organization_id: string;
  workspace_id: string;
  kind: CapabilityKind;
  capability_id: string;
  enabled: boolean;
  require_approval?: boolean;
};
