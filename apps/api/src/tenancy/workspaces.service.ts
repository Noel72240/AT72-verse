import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import { ensureFirstPartyTenantPackages, type PrismaClient } from "@at72-verse/db";
import { PRISMA } from "../auth/auth.tokens.js";
import { RbacService } from "../rbac/rbac.service.js";

export type CreateWorkspaceInput = {
  organizationId: string;
  name: string;
  slug: string;
  creatorUserId: string;
};

@Injectable()
export class WorkspacesService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly rbac: RbacService,
  ) {}

  async create(input: CreateWorkspaceInput) {
    const name = input.name.trim();
    const slug = input.slug.trim().toLowerCase();
    if (!name || !slug) {
      throw new BadRequestException({
        code: "invalid_input",
        message: "name and slug are required",
      });
    }

    // RBAC already enforced by guard; still scope writes to org.
    await this.rbac.requireOrgMember(input.creatorUserId, input.organizationId);

    try {
      const workspace = await this.prisma.$transaction(async (tx) => {
        const workspace = await tx.workspace.create({
          data: {
            organizationId: input.organizationId,
            name,
            slug,
          },
        });
        await tx.workspaceMember.create({
          data: {
            organizationId: input.organizationId,
            workspaceId: workspace.id,
            userId: input.creatorUserId,
            role: "OWNER",
          },
        });
        return workspace;
      });
      // DP6 / DN12 — seed packages for org (idempotent) + grants for this workspace.
      await ensureFirstPartyTenantPackages(
        this.prisma,
        input.organizationId,
        workspace.id,
      );
      return workspace;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/unique/i.test(message)) {
        throw new ConflictException({
          code: "conflict",
          message: "Workspace slug already exists in this organization",
        });
      }
      throw err;
    }
  }

  async listForOrganization(organizationId: string, userId: string) {
    await this.rbac.requireOrgMember(userId, organizationId);
    return this.prisma.workspace.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
    });
  }

  async getById(workspaceId: string, userId: string) {
    const membership = await this.rbac.requireWorkspaceMember(userId, workspaceId);
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
    });
    // Defense in depth: membership.organizationId must match workspace.
    if (workspace.organizationId !== membership.organizationId) {
      await this.rbac.requireWorkspaceInOrganization(workspaceId, membership.organizationId);
    }
    return {
      workspace,
      membershipRole: membership.role,
    };
  }
}
