/**
 * Package install gate tests (Phase 22 / DP14).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { KernelError } from "@at72-verse/verse-kernel";
import {
  assertCapabilityInstalled,
  buildPackagesSnapshotFromSeeds,
  isCapabilityInstalled,
} from "./package-install-gate.js";

describe("PackageInstallGate Phase 22", () => {
  it("detects installed nova in full seed snapshot", () => {
    const snap = buildPackagesSnapshotFromSeeds("org-1", {
      captured_at: "2026-07-19T12:00:00.000Z",
    });
    assert.equal(isCapabilityInstalled(snap, "agent", "nova"), true);
    assert.equal(isCapabilityInstalled(snap, "agent", "orion"), true);
    assert.equal(isCapabilityInstalled(snap, "agent", "pulse"), true);
    assert.equal(isCapabilityInstalled(snap, "agent", "echo"), true);
    assert.equal(isCapabilityInstalled(snap, "agent", "nexus"), true);
    assert.equal(isCapabilityInstalled(snap, "agent", "vega"), true);
    assert.equal(isCapabilityInstalled(snap, "agent", "neo"), true);
    assert.equal(isCapabilityInstalled(snap, "agent", "kira"), true);
    assert.equal(isCapabilityInstalled(snap, "agent", "nyx"), true);
  });

  it("refuses when nova excluded (uninstall)", () => {
    const snap = buildPackagesSnapshotFromSeeds("org-1", {
      excludePackageIds: ["pkg.nova"],
      captured_at: "2026-07-19T12:00:00.000Z",
    });
    assert.equal(isCapabilityInstalled(snap, "agent", "nova"), false);
    assert.equal(isCapabilityInstalled(snap, "agent", "adam"), true);
    assert.throws(
      () =>
        assertCapabilityInstalled({
          packages_snapshot: snap,
          kind: "agent",
          capability_id: "nova",
        }),
      (err: unknown) =>
        err instanceof KernelError &&
        err.code === "FORBIDDEN" &&
        Array.isArray(err.details?.reasons) &&
        (err.details!.reasons as string[]).includes("package_not_installed"),
    );
  });

  it("refuses when packages_snapshot missing", () => {
    assert.throws(
      () =>
        assertCapabilityInstalled({
          kind: "agent",
          capability_id: "adam",
        }),
      (err: unknown) => err instanceof KernelError && err.code === "FORBIDDEN",
    );
  });
});
