/**
 * Package Registry contracts (Phase 22 / DP1–DP7).
 * Metadata + install snapshots — code loading stays Runtime-owned (DP2 · DP11).
 */
import type { IsoDateTime, SemVer, UlidOrUuid } from "../common/primitives.js";
import type { CapabilityKind } from "../permissions/permission-grant.js";
import type { PackageKind, PackageManifest } from "../packages/package-manifest.js";

/** Stable mapping: package → executable capability id (agent/skill/tool id). */
export type FirstPartyPackageSeed = {
  package_id: string;
  kind: PackageKind;
  /** Capability id used by Permission Engine / Runtime registries. */
  capability_id: string;
  version: SemVer;
  manifest: PackageManifest;
  /** Default grant enabled when org is seeded (DP10). */
  default_grant_enabled: boolean;
};

/** Frozen installs for a run (DP9) — stamped at dispatch like grants_snapshot. */
export type PackagesSnapshot = {
  version: "1";
  organization_id: UlidOrUuid;
  captured_at: IsoDateTime;
  packages: Array<{
    package_id: string;
    kind: PackageKind;
    capability_id: string;
    pinned_version: string;
  }>;
};

export type TenantPackageStatus = "installed" | "uninstalled";

export type TenantPackageRecord = {
  id: UlidOrUuid;
  organization_id: UlidOrUuid;
  package_id: string;
  pinned_version: string;
  status: TenantPackageStatus;
  installed_at: IsoDateTime;
  uninstalled_at: IsoDateTime | null;
  updated_at: IsoDateTime;
};

export type PackageCatalogEntry = {
  package_id: string;
  kind: PackageKind;
  capability_id: string;
  latest_version: string;
  manifest: PackageManifest;
};

/** Denial when package not installed for the org (DP9). */
export type PackageInstallDenialReason = "package_not_installed" | "packages_snapshot_missing";

export function capabilityKindFromPackageKind(kind: PackageKind): CapabilityKind | null {
  if (kind === "agent" || kind === "skill" || kind === "tool") return kind;
  return null;
}
