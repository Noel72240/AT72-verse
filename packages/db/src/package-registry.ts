/**
 * Package Registry persistence (Phase 22).
 */
import {
  FIRST_PARTY_PACKAGE_SEEDS,
  type PackageManifest,
  type PackagesSnapshot,
  type TenantPackageRecord,
  type TenantPackageStatus,
} from "@at72-verse/contracts";
import type { PrismaClient } from "./client.js";
import { ensureFirstPartyCapabilityGrants, upsertCapabilityGrant } from "./capability-grants.js";

function toTenantRecord(row: {
  id: string;
  organizationId: string;
  packageId: string;
  pinnedVersion: string;
  status: string;
  installedAt: Date;
  uninstalledAt: Date | null;
  updatedAt: Date;
}): TenantPackageRecord {
  return {
    id: row.id,
    organization_id: row.organizationId,
    package_id: row.packageId,
    pinned_version: row.pinnedVersion,
    status: row.status as TenantPackageStatus,
    installed_at: row.installedAt.toISOString(),
    uninstalled_at: row.uninstalledAt?.toISOString() ?? null,
    updated_at: row.updatedAt.toISOString(),
  };
}

/** Ensure global catalog rows + immutable versions exist (idempotent). */
export async function ensureFirstPartyPackageCatalog(prisma: PrismaClient): Promise<void> {
  for (const seed of FIRST_PARTY_PACKAGE_SEEDS) {
    await prisma.package.upsert({
      where: { id: seed.package_id },
      create: {
        id: seed.package_id,
        kind: seed.kind,
        publisher: seed.manifest.publisher,
        displayName: seed.manifest.display_name,
        description: seed.manifest.description,
        capabilityId: seed.capability_id,
      },
      update: {
        displayName: seed.manifest.display_name,
        description: seed.manifest.description,
        capabilityId: seed.capability_id,
      },
    });
    const existing = await prisma.packageVersion.findUnique({
      where: {
        packageId_version: {
          packageId: seed.package_id,
          version: seed.version,
        },
      },
    });
    if (!existing) {
      await prisma.packageVersion.create({
        data: {
          packageId: seed.package_id,
          version: seed.version,
          manifest: seed.manifest as object,
        },
      });
    }
  }
}

/** Install all first-party packages for an org + seed grants on a workspace (DP6 · DP10). */
export async function ensureFirstPartyTenantPackages(
  prisma: PrismaClient,
  organizationId: string,
  workspaceId: string,
): Promise<TenantPackageRecord[]> {
  await ensureFirstPartyPackageCatalog(prisma);
  for (const seed of FIRST_PARTY_PACKAGE_SEEDS) {
    await prisma.tenantPackage.upsert({
      where: {
        organizationId_packageId: {
          organizationId,
          packageId: seed.package_id,
        },
      },
      create: {
        organizationId,
        packageId: seed.package_id,
        pinnedVersion: seed.version,
        status: "installed",
      },
      update: {},
    });
  }
  await ensureFirstPartyCapabilityGrants(prisma, organizationId, workspaceId);
  return listTenantPackages(prisma, organizationId);
}

export async function listCatalogPackages(prisma: PrismaClient) {
  await ensureFirstPartyPackageCatalog(prisma);
  const rows = await prisma.package.findMany({
    include: {
      versions: { orderBy: { publishedAt: "asc" } },
    },
    orderBy: { id: "asc" },
  });
  return rows.map((p) => {
    const latest = p.versions[p.versions.length - 1]!;
    return {
      package_id: p.id,
      kind: p.kind,
      capability_id: p.capabilityId,
      publisher: p.publisher,
      display_name: p.displayName,
      description: p.description,
      latest_version: latest.version,
      versions: p.versions.map((v) => v.version),
      manifest: latest.manifest as unknown as PackageManifest,
    };
  });
}

export async function listTenantPackages(
  prisma: PrismaClient,
  organizationId: string,
): Promise<TenantPackageRecord[]> {
  const rows = await prisma.tenantPackage.findMany({
    where: { organizationId },
    orderBy: { packageId: "asc" },
  });
  return rows.map(toTenantRecord);
}

export async function installTenantPackage(
  prisma: PrismaClient,
  input: {
    organization_id: string;
    package_id: string;
    pinned_version?: string;
    /** Workspace used to seed default grants (DP10). */
    workspace_id: string;
  },
): Promise<TenantPackageRecord> {
  await ensureFirstPartyPackageCatalog(prisma);
  const pkg = await prisma.package.findUnique({ where: { id: input.package_id } });
  if (!pkg) {
    throw new Error(`Unknown package: ${input.package_id}`);
  }
  const version =
    input.pinned_version ??
    (
      await prisma.packageVersion.findFirst({
        where: { packageId: input.package_id },
        orderBy: { publishedAt: "desc" },
      })
    )?.version;
  if (!version) {
    throw new Error(`No version for package: ${input.package_id}`);
  }
  const ver = await prisma.packageVersion.findUnique({
    where: { packageId_version: { packageId: input.package_id, version } },
  });
  if (!ver) {
    throw new Error(`Unknown version ${version} for ${input.package_id}`);
  }

  const row = await prisma.tenantPackage.upsert({
    where: {
      organizationId_packageId: {
        organizationId: input.organization_id,
        packageId: input.package_id,
      },
    },
    create: {
      organizationId: input.organization_id,
      packageId: input.package_id,
      pinnedVersion: version,
      status: "installed",
    },
    update: {
      pinnedVersion: version,
      status: "installed",
      uninstalledAt: null,
      installedAt: new Date(),
    },
  });

  const seed = FIRST_PARTY_PACKAGE_SEEDS.find((s) => s.package_id === input.package_id);
  if (seed && (seed.kind === "agent" || seed.kind === "skill" || seed.kind === "tool")) {
    await upsertCapabilityGrant(prisma, {
      organization_id: input.organization_id,
      workspace_id: input.workspace_id,
      kind: seed.kind,
      capability_id: seed.capability_id,
      enabled: seed.default_grant_enabled,
    });
  }

  return toTenantRecord(row);
}

export async function uninstallTenantPackage(
  prisma: PrismaClient,
  input: { organization_id: string; package_id: string },
): Promise<TenantPackageRecord> {
  const existing = await prisma.tenantPackage.findUnique({
    where: {
      organizationId_packageId: {
        organizationId: input.organization_id,
        packageId: input.package_id,
      },
    },
  });
  if (!existing) {
    throw new Error(`Package not installed: ${input.package_id}`);
  }
  // Soft uninstall — never delete Runs / memory / audit (DP14).
  const row = await prisma.tenantPackage.update({
    where: { id: existing.id },
    data: {
      status: "uninstalled",
      uninstalledAt: new Date(),
    },
  });
  return toTenantRecord(row);
}

export async function pinTenantPackage(
  prisma: PrismaClient,
  input: { organization_id: string; package_id: string; pinned_version: string },
): Promise<TenantPackageRecord> {
  const ver = await prisma.packageVersion.findUnique({
    where: {
      packageId_version: {
        packageId: input.package_id,
        version: input.pinned_version,
      },
    },
  });
  if (!ver) {
    throw new Error(`Unknown version ${input.pinned_version} for ${input.package_id}`);
  }
  const existing = await prisma.tenantPackage.findUnique({
    where: {
      organizationId_packageId: {
        organizationId: input.organization_id,
        packageId: input.package_id,
      },
    },
  });
  if (!existing || existing.status !== "installed") {
    throw new Error(`Package not installed: ${input.package_id}`);
  }
  const row = await prisma.tenantPackage.update({
    where: { id: existing.id },
    data: { pinnedVersion: input.pinned_version },
  });
  return toTenantRecord(row);
}

export async function buildPackagesSnapshot(
  prisma: PrismaClient,
  organizationId: string,
): Promise<PackagesSnapshot> {
  await ensureFirstPartyPackageCatalog(prisma);
  const rows = await prisma.tenantPackage.findMany({
    where: { organizationId, status: "installed" },
    include: { package: true },
    orderBy: { packageId: "asc" },
  });
  return {
    version: "1",
    organization_id: organizationId,
    captured_at: new Date().toISOString(),
    packages: rows.map((r) => ({
      package_id: r.packageId,
      kind: r.package.kind as PackagesSnapshot["packages"][number]["kind"],
      capability_id: r.package.capabilityId,
      pinned_version: r.pinnedVersion,
    })),
  };
}

export async function isPackageInstalledForCapability(
  prisma: PrismaClient,
  organizationId: string,
  capabilityId: string,
): Promise<boolean> {
  const pkg = await prisma.package.findFirst({
    where: { capabilityId },
  });
  if (!pkg) return false;
  const tp = await prisma.tenantPackage.findUnique({
    where: {
      organizationId_packageId: {
        organizationId,
        packageId: pkg.id,
      },
    },
  });
  return tp?.status === "installed";
}
