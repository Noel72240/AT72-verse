import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  buildPackagesSnapshot,
  ensureFirstPartyPackageCatalog,
  ensureFirstPartyTenantPackages,
  installTenantPackage,
  listCatalogPackages,
  listTenantPackages,
  pinTenantPackage,
  uninstallTenantPackage,
  type PrismaClient,
} from "@at72-verse/db";
import { PRISMA } from "../auth/auth.tokens.js";
import { QuotasService } from "../quotas/quotas.service.js";
import { RbacService } from "../rbac/rbac.service.js";

@Injectable()
export class PackagesService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly rbac: RbacService,
    private readonly quotas: QuotasService,
  ) {}

  async listCatalogPublic() {
    await ensureFirstPartyPackageCatalog(this.prisma);
    return { packages: await listCatalogPackages(this.prisma) };
  }

  async listForOrganization(organizationId: string, userId: string) {
    await this.rbac.requireOrgMember(userId, organizationId);
    await ensureFirstPartyPackageCatalog(this.prisma);
    const installs = await listTenantPackages(this.prisma, organizationId);
    return { installs };
  }

  async install(
    organizationId: string,
    userId: string,
    input: { package_id: string; pinned_version?: string; workspace_id?: string },
  ) {
    await this.rbac.requireOrgRole(userId, organizationId, "ADMIN");
    if (!input.package_id?.trim()) {
      throw new BadRequestException({
        code: "invalid_input",
        message: "package_id required",
      });
    }
    await this.quotas.assertCanInstallAgent(organizationId, input.package_id.trim());
    const workspaceId =
      input.workspace_id ??
      (
        await this.prisma.workspace.findFirst({
          where: { organizationId },
          orderBy: { createdAt: "asc" },
        })
      )?.id;
    if (!workspaceId) {
      throw new BadRequestException({
        code: "invalid_input",
        message: "organization has no workspace for grant seeding",
      });
    }
    try {
      const install = await installTenantPackage(this.prisma, {
        organization_id: organizationId,
        package_id: input.package_id.trim(),
        pinned_version: input.pinned_version,
        workspace_id: workspaceId,
      });
      return { install };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException({
        code: "invalid_input",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async uninstall(organizationId: string, userId: string, packageId: string) {
    await this.rbac.requireOrgRole(userId, organizationId, "ADMIN");
    try {
      const install = await uninstallTenantPackage(this.prisma, {
        organization_id: organizationId,
        package_id: packageId,
      });
      return { install };
    } catch (err) {
      throw new NotFoundException({
        code: "not_found",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async pin(
    organizationId: string,
    userId: string,
    packageId: string,
    pinnedVersion: string,
  ) {
    await this.rbac.requireOrgRole(userId, organizationId, "ADMIN");
    if (!pinnedVersion?.trim()) {
      throw new BadRequestException({
        code: "invalid_input",
        message: "pinned_version required",
      });
    }
    try {
      const install = await pinTenantPackage(this.prisma, {
        organization_id: organizationId,
        package_id: packageId,
        pinned_version: pinnedVersion.trim(),
      });
      return { install };
    } catch (err) {
      throw new BadRequestException({
        code: "invalid_input",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async snapshotForOrganization(organizationId: string) {
    return buildPackagesSnapshot(this.prisma, organizationId);
  }

  async assertAgentPackageInstalled(organizationId: string, agentId: string) {
    const snapshot = await this.snapshotForOrganization(organizationId);
    const row = snapshot.packages.find(
      (p) => p.kind === "agent" && p.capability_id === agentId,
    );
    if (!row) {
      throw new BadRequestException({
        code: "package_not_installed",
        message: `Agent package not installed: ${agentId}`,
        reasons: ["package_not_installed"],
      });
    }
    return snapshot;
  }

  async assertWorkflowPackageInstalled(organizationId: string, workflowId: string) {
    const snapshot = await this.snapshotForOrganization(organizationId);
    const row = snapshot.packages.find(
      (p) => p.kind === "workflow" && p.capability_id === workflowId,
    );
    if (!row) {
      throw new BadRequestException({
        code: "package_not_installed",
        message: `Workflow package not installed: ${workflowId}`,
        reasons: ["package_not_installed"],
      });
    }
    return snapshot;
  }

  async seedFirstParty(organizationId: string, workspaceId: string) {
    return ensureFirstPartyTenantPackages(this.prisma, organizationId, workspaceId);
  }
}
