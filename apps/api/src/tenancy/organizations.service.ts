import { BadRequestException, ConflictException, Inject, Injectable } from "@nestjs/common";
import { ensureFirstPartyTenantPackages, type PrismaClient } from "@at72-verse/db";
import { PRISMA } from "../auth/auth.tokens.js";

export type CreateOrganizationInput = {
  name: string;
  slug: string;
  creatorUserId: string;
};

@Injectable()
export class OrganizationsService {
  constructor(@Inject(PRISMA) private readonly prisma: PrismaClient) {}

  async create(input: CreateOrganizationInput) {
    const name = input.name.trim();
    const slug = input.slug.trim().toLowerCase();
    if (!name || !slug) {
      throw new BadRequestException({
        code: "invalid_input",
        message: "name and slug are required",
      });
    }

    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: { name, slug },
        });
        await tx.membership.create({
          data: {
            organizationId: org.id,
            userId: input.creatorUserId,
            role: "OWNER",
          },
        });
        const workspace = await tx.workspace.create({
          data: {
            organizationId: org.id,
            name: "Default",
            slug: "default",
          },
        });
        await tx.workspaceMember.create({
          data: {
            organizationId: org.id,
            workspaceId: workspace.id,
            userId: input.creatorUserId,
            role: "OWNER",
          },
        });
        return { organization: org, workspace };
      });
      // DP6 / DN12 — seed first-party packages + capability grants on default workspace.
      await ensureFirstPartyTenantPackages(
        this.prisma,
        created.organization.id,
        created.workspace.id,
      );
      return created;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (/unique/i.test(message)) {
        throw new ConflictException({
          code: "conflict",
          message: "Organization slug already exists",
        });
      }
      console.error("[organizations.create]", message);
      throw new BadRequestException({
        code: "org_create_failed",
        message,
      });
    }
  }

  async listForUser(userId: string) {
    try {
      const memberships = await this.prisma.membership.findMany({
        where: {
          userId,
          OR: [
            { organization: { deletedAt: null } },
            { role: "OWNER", organization: { deletedAt: { not: null } } },
          ],
        },
        include: { organization: true },
        orderBy: { createdAt: "asc" },
      });
      return memberships.map((m) => ({
        role: m.role,
        organization: {
          id: m.organization.id,
          name: m.organization.name,
          slug: m.organization.slug,
          planId: m.organization.planId,
          createdAt: m.organization.createdAt,
          updatedAt: m.organization.updatedAt,
          deletedAt: m.organization.deletedAt,
        },
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[organizations.listForUser]", message);
      throw new BadRequestException({
        code: "org_list_failed",
        message,
      });
    }
  }
}
