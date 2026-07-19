import type { OrgRole, WorkspaceRole } from "@at72-verse/db";

/** Official role hierarchy until a future ADR (Phase 06 Decision F). */
export const ORG_ROLE_RANK: Record<OrgRole, number> = {
  VIEWER: 1,
  EDITOR: 2,
  ADMIN: 3,
  OWNER: 4,
};

export const WORKSPACE_ROLE_RANK: Record<WorkspaceRole, number> = {
  VIEWER: 1,
  EDITOR: 2,
  ADMIN: 3,
  OWNER: 4,
};

export function orgRoleAtLeast(actual: OrgRole, minimum: OrgRole): boolean {
  return ORG_ROLE_RANK[actual] >= ORG_ROLE_RANK[minimum];
}

export function workspaceRoleAtLeast(actual: WorkspaceRole, minimum: WorkspaceRole): boolean {
  return WORKSPACE_ROLE_RANK[actual] >= WORKSPACE_ROLE_RANK[minimum];
}
