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
      throw err;
    }
  }

  async listForUser(userId: string) {
    const memberships = await this.prisma.membership.findMany({
      where: { userId },
      include: { organization: true },
      orderBy: { createdAt: "asc" },
    });
    return memberships.map((m) => ({
      role: m.role,
      organization: m.organization,
    }));
  }
}
