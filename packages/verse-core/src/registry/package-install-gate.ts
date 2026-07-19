/**
 * Package install gate (Phase 22 / DP3 · DP9).
 * Separate from Permission Engine — install ≠ enable.
 */
import type {
  PackageKind,
  PackagesSnapshot,
} from "@at72-verse/contracts";
import { FIRST_PARTY_PACKAGE_SEEDS } from "@at72-verse/contracts";
import { KernelError } from "@at72-verse/verse-kernel";

export function buildPackagesSnapshotFromSeeds(
  organizationId: string,
  opts?: { excludePackageIds?: string[]; captured_at?: string },
): PackagesSnapshot {
  const exclude = new Set(opts?.excludePackageIds ?? []);
  return {
    version: "1",
    organization_id: organizationId,
    captured_at: opts?.captured_at ?? new Date().toISOString(),
    packages: FIRST_PARTY_PACKAGE_SEEDS.filter((s) => !exclude.has(s.package_id)).map((s) => ({
      package_id: s.package_id,
      kind: s.kind,
      capability_id: s.capability_id,
      pinned_version: s.version,
    })),
  };
}

export function isCapabilityInstalled(
  snapshot: PackagesSnapshot | null | undefined,
  kind: PackageKind,
  capabilityId: string,
): boolean {
  if (!snapshot) return false;
  return snapshot.packages.some(
    (p) => p.kind === kind && p.capability_id === capabilityId,
  );
}

export function assertCapabilityInstalled(input: {
  packages_snapshot?: PackagesSnapshot | null;
  kind: PackageKind;
  capability_id: string;
}): void {
  if (!input.packages_snapshot) {
    throw new KernelError("FORBIDDEN", `Package not installed: ${input.capability_id}`, {
      details: {
        reasons: ["packages_snapshot_missing"],
        kind: input.kind,
        capability_id: input.capability_id,
      },
    });
  }
  if (!isCapabilityInstalled(input.packages_snapshot, input.kind, input.capability_id)) {
    throw new KernelError("FORBIDDEN", `Package not installed: ${input.capability_id}`, {
      details: {
        reasons: ["package_not_installed"],
        kind: input.kind,
        capability_id: input.capability_id,
      },
    });
  }
}

export function findCatalogEntryByCapability(capabilityId: string) {
  return FIRST_PARTY_PACKAGE_SEEDS.find((s) => s.capability_id === capabilityId) ?? null;
}

export function findCatalogEntryByPackageId(packageId: string) {
  return FIRST_PARTY_PACKAGE_SEEDS.find((s) => s.package_id === packageId) ?? null;
}

export function listCatalogEntries() {
  return FIRST_PARTY_PACKAGE_SEEDS.map((s) => ({
    package_id: s.package_id,
    kind: s.kind,
    capability_id: s.capability_id,
    latest_version: s.version,
    manifest: s.manifest,
  }));
}
