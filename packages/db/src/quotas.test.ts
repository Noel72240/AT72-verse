/**
 * Phase 31 — resolve limits + audit shape (no DB).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PLAN_QUOTA_DEFAULTS } from "@at72-verse/contracts";
import { resolveOrgQuotaLimits, utcMonthWindow } from "./quotas.js";

describe("resolveOrgQuotaLimits (EB3bis)", () => {
  it("uses plan defaults when overrides are null", () => {
    const limits = resolveOrgQuotaLimits({
      planId: "free",
      quotaRunsPerMonth: null,
      quotaTokensPerMonth: null,
      quotaMaxAgentsInstalled: null,
      quotaApiRpm: null,
    });
    assert.equal(limits.plan_id, "free");
    assert.equal(limits.runs_per_month, PLAN_QUOTA_DEFAULTS.free.runs_per_month);
    assert.equal(limits.api_rpm, PLAN_QUOTA_DEFAULTS.free.api_rpm);
  });

  it("applies numeric overrides over plan defaults", () => {
    const limits = resolveOrgQuotaLimits({
      planId: "enterprise",
      quotaRunsPerMonth: 42,
      quotaTokensPerMonth: null,
      quotaMaxAgentsInstalled: 7,
      quotaApiRpm: null,
    });
    assert.equal(limits.runs_per_month, 42);
    assert.equal(limits.max_agents_installed, 7);
    assert.equal(limits.tokens_per_month, PLAN_QUOTA_DEFAULTS.enterprise.tokens_per_month);
    assert.equal(typeof limits.tokens_per_month, "number");
    assert.notEqual(limits.tokens_per_month, Infinity);
  });

  it("falls back to free for unknown plan_id", () => {
    const limits = resolveOrgQuotaLimits({
      planId: "mystery",
      quotaRunsPerMonth: null,
      quotaTokensPerMonth: null,
      quotaMaxAgentsInstalled: null,
      quotaApiRpm: null,
    });
    assert.equal(limits.plan_id, "free");
  });
});

describe("utcMonthWindow", () => {
  it("returns ISO reset_at at next UTC month start", () => {
    const { start, end, resetAt } = utcMonthWindow(new Date("2026-07-19T14:00:00.000Z"));
    assert.equal(start.toISOString(), "2026-07-01T00:00:00.000Z");
    assert.equal(end.toISOString(), "2026-08-01T00:00:00.000Z");
    assert.equal(resetAt, "2026-08-01T00:00:00.000Z");
  });
});
