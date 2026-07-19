import {
  ForbiddenException,
  GoneException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { OrgRole, PrismaClient, WorkspaceRole } from "@at72-verse/db";
import { PRISMA } from "../auth/auth.tokens.js";
import { orgRoleAtLeast, workspaceRoleAtLeast } from "./role-hierarchy.js";

/**
 * Single Verse RBAC service (Phase 06 Decision F).
 * Controllers must not embed permission checks — use this service / RbacGuard.
 */
@Injectable()
export class RbacService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async getOrgMembership(userId: string, organizationId: string) {
    return this.prisma.membership.findUnique({
      where: {
        organizationId_userId: { organizationId, userId },
      },
    });
  }

  async requireOrgRole(
    userId: string,
    organizationId: string,
    minimum: OrgRole,
    options?: { allowDeleted?: boolean },
  ): Promise<{ role: OrgRole }> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, deletedAt: true },
    });
    if (!org) {
      throw new NotFoundException({
        code: "not_found",
        message: "Organization not found",
      });
    }
    if (org.deletedAt && !options?.allowDeleted) {
      throw new GoneException({
        code: "gone",
        message: "Organization has been soft-deleted",
      });
    }
    const membership = await this.getOrgMembership(userId, organizationId);
    if (!membership) {
      throw new ForbiddenException({
        code: "forbidden",
        message: "Not a member of this organization",
      });
    }
    if (!orgRoleAtLeast(membership.role, minimum)) {
      throw new ForbiddenException({
        code: "forbidden",
        message: `Requires org role ${minimum} or higher`,
      });
    }
    return { role: membership.role };
  }

  async requireOrgMember(userId: string, organizationId: string): Promise<{ role: OrgRole }> {
    return this.requireOrgRole(userId, organizationId, "VIEWER");
  }

  async getWorkspaceMembership(userId: string, workspaceId: string) {
    return this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: { workspaceId, userId },
      },
    });
  }

  /**
   * Verifies workspace membership. Never trusts client headers alone.
   */
  async requireWorkspaceMember(
    userId: string,
    workspaceId: string,
    minimum: WorkspaceRole = "VIEWER",
  ): Promise<{ role: WorkspaceRole; organizationId: string }> {
    const membership = await this.getWorkspaceMembership(userId, workspaceId);
    if (!membership) {
      throw new NotFoundException({
        code: "not_found",
        message: "Workspace not found",
      });
    }
    const org = await this.prisma.organization.findUnique({
      where: { id: membership.organizationId },
      select: { deletedAt: true },
    });
    if (org?.deletedAt) {
      throw new GoneException({
        code: "gone",
        message: "Organization has been soft-deleted",
      });
    }
    if (!workspaceRoleAtLeast(membership.role, minimum)) {
      throw new ForbiddenException({
        code: "forbidden",
        message: `Requires workspace role ${minimum} or higher`,
      });
    }
    return {
      role: membership.role,
      organizationId: membership.organizationId,
    };
  }

  /**
   * Ensures a workspace belongs to the given organization (Decision E1).
   */
  async requireWorkspaceInOrganization(workspaceId: string, organizationId: string): Promise<void> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, organizationId: true },
    });
    if (!workspace || workspace.organizationId !== organizationId) {
      throw new NotFoundException({
        code: "not_found",
        message: "Workspace not found in organization",
      });
    }
  }
}
