/**
 * Phase 32 — retention clamps (EC8 / EC8bis).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AUDIT_RETENTION_DAYS_MIN,
  SOFT_DELETE_GRACE_DAYS_MAX,
  SOFT_DELETE_GRACE_DAYS_MIN,
} from "@at72-verse/contracts";
import { clampAuditRetentionDays, clampSoftDeleteGraceDays } from "./privacy.js";

describe("retention clamps (EC8bis)", () => {
  it("soft-delete grace is bounded 7–90", () => {
    assert.equal(clampSoftDeleteGraceDays(1), SOFT_DELETE_GRACE_DAYS_MIN);
    assert.equal(clampSoftDeleteGraceDays(30), 30);
    assert.equal(clampSoftDeleteGraceDays(999), SOFT_DELETE_GRACE_DAYS_MAX);
  });

  it("audit retention cannot go below 365 days", () => {
    assert.equal(clampAuditRetentionDays(30), AUDIT_RETENTION_DAYS_MIN);
    assert.equal(clampAuditRetentionDays(365), 365);
    assert.equal(clampAuditRetentionDays(730), 730);
  });
});
