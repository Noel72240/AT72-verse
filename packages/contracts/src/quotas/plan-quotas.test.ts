/**
 * Phase 31 — plan quotas (EB3bis: all numeric, no unlimited).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PLAN_QUOTA_DEFAULTS, type PlanId } from "./plan-quotas.js";

describe("PLAN_QUOTA_DEFAULTS (EB3bis)", () => {
  const plans: PlanId[] = ["free", "pro", "enterprise"];

  it("defines only numeric positive limits for every plan", () => {
    for (const plan of plans) {
      const d = PLAN_QUOTA_DEFAULTS[plan];
      for (const key of [
        "runs_per_month",
        "tokens_per_month",
        "max_agents_installed",
        "api_rpm",
      ] as const) {
        assert.equal(typeof d[key], "number", `${plan}.${key} must be number`);
        assert.ok(Number.isFinite(d[key]) && d[key] > 0, `${plan}.${key} must be finite > 0`);
        assert.notEqual(d[key], Infinity);
      }
    }
  });

  it("enterprise ceilings are strictly higher than pro", () => {
    const pro = PLAN_QUOTA_DEFAULTS.pro;
    const ent = PLAN_QUOTA_DEFAULTS.enterprise;
    assert.ok(ent.runs_per_month > pro.runs_per_month);
    assert.ok(ent.tokens_per_month > pro.tokens_per_month);
    assert.ok(ent.max_agents_installed > pro.max_agents_installed);
    assert.ok(ent.api_rpm > pro.api_rpm);
  });
});
