/**
 * Technical plans & quotas (Phase 31 / EB2–EB3).
 * All limits are numeric — no "unlimited" (EB3bis).
 */
import type { IsoDateTime, UlidOrUuid } from "../common/primitives.js";

export type PlanId = "free" | "pro" | "enterprise";

export type QuotaDimension =
  | "runs_per_month"
  | "tokens_per_month"
  | "max_agents_installed"
  | "api_rpm";

/** Effective numeric quotas for an organization. */
export type OrgQuotaLimits = {
  plan_id: PlanId;
  runs_per_month: number;
  tokens_per_month: number;
  max_agents_installed: number;
  api_rpm: number;
};

/** Plan defaults — Enterprise uses very high technical ceilings (EB3bis). */
export const PLAN_QUOTA_DEFAULTS: Readonly<Record<PlanId, Omit<OrgQuotaLimits, "plan_id">>> = {
  free: {
    runs_per_month: 100,
    tokens_per_month: 500_000,
    max_agents_installed: 5,
    api_rpm: 60,
  },
  pro: {
    runs_per_month: 2_000,
    tokens_per_month: 10_000_000,
    max_agents_installed: 12,
    api_rpm: 300,
  },
  enterprise: {
    runs_per_month: 1_000_000,
    tokens_per_month: 1_000_000_000,
    max_agents_installed: 100,
    api_rpm: 1_000,
  },
} as const;

export type OrgQuotaUsage = {
  runs_this_month: number;
  tokens_this_month: number;
  agents_installed: number;
};

export type QuotaExceededPublic = {
  code: "QUOTA_EXCEEDED";
  quota: QuotaDimension;
  limit: number;
  used: number;
  reset_at: IsoDateTime;
  upgrade_hint: string;
};

/** Lightweight audit of quota overrides (EB7bis) — not full RGPD audit (P32). */
export type QuotaAuditEntryPublic = {
  id: UlidOrUuid;
  organization_id: UlidOrUuid;
  actor_user_id: UlidOrUuid;
  previous_value: OrgQuotaLimits;
  new_value: OrgQuotaLimits;
  reason: string | null;
  created_at: IsoDateTime;
};
