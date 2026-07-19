import { SetMetadata } from "@nestjs/common";
import type { OrgRole, WorkspaceRole } from "@at72-verse/db";

export const RBAC_META_KEY = "verse_rbac";

export type RbacRequirement =
  | {
      type: "org";
      minimum: OrgRole;
      /** Route param name holding organization id. */
      orgParam?: string;
    }
  | {
      type: "workspace";
      minimum: WorkspaceRole;
      workspaceParam?: string;
    };

export const RequireOrgRole = (
  minimum: OrgRole,
  orgParam = "orgId",
): MethodDecorator & ClassDecorator =>
  SetMetadata(RBAC_META_KEY, {
    type: "org",
    minimum,
    orgParam,
  } satisfies RbacRequirement);

export const RequireWorkspaceMember = (
  minimum: WorkspaceRole = "VIEWER",
  workspaceParam = "workspaceId",
): MethodDecorator & ClassDecorator =>
  SetMetadata(RBAC_META_KEY, {
    type: "workspace",
    minimum,
    workspaceParam,
  } satisfies RbacRequirement);
