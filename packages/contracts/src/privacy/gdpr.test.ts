/**
 * Phase 32 — GDPR contract constants.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AUDIT_RETENTION_DAYS_DEFAULT,
  AUDIT_RETENTION_DAYS_MIN,
  SOFT_DELETE_GRACE_DAYS_DEFAULT,
} from "./gdpr.js";

describe("GDPR defaults (EC8bis)", () => {
  it("audit retention default equals minimum 365", () => {
    assert.equal(AUDIT_RETENTION_DAYS_DEFAULT, 365);
    assert.equal(AUDIT_RETENTION_DAYS_MIN, 365);
    assert.ok(AUDIT_RETENTION_DAYS_DEFAULT >= AUDIT_RETENTION_DAYS_MIN);
  });

  it("soft-delete grace default is 30", () => {
    assert.equal(SOFT_DELETE_GRACE_DAYS_DEFAULT, 30);
  });
});
