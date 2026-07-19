/**
 * Organization plan quotas (Phase 31 / EB3bis — all limits numeric).
 */
import {
  PLAN_QUOTA_DEFAULTS,
  type OrgQuotaLimits,
  type OrgQuotaUsage,
  type PlanId,
  type QuotaAuditEntryPublic,
  type QuotaDimension,
} from "@at72-verse/contracts";
import type { Prisma, PrismaClient } from "./client.js";

const PLAN_IDS = new Set<PlanId>(["free", "pro", "enterprise"]);

export function isPlanId(value: string): value is PlanId {
  return PLAN_IDS.has(value as PlanId);
}

export function utcMonthWindow(now = new Date()): { start: Date; end: Date; resetAt: string } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  return { start, end, resetAt: end.toISOString() };
}

export function resolveOrgQuotaLimits(org: {
  planId: string;
  quotaRunsPerMonth: number | null;
  quotaTokensPerMonth: number | null;
  quotaMaxAgentsInstalled: number | null;
  quotaApiRpm: number | null;
}): OrgQuotaLimits {
  const plan_id: PlanId = isPlanId(org.planId) ? org.planId : "free";
  const defaults = PLAN_QUOTA_DEFAULTS[plan_id];
  return {
    plan_id,
    runs_per_month: org.quotaRunsPerMonth ?? defaults.runs_per_month,
    tokens_per_month: org.quotaTokensPerMonth ?? defaults.tokens_per_month,
    max_agents_installed: org.quotaMaxAgentsInstalled ?? defaults.max_agents_installed,
    api_rpm: org.quotaApiRpm ?? defaults.api_rpm,
  };
}

export async function getOrgQuotaLimits(
  prisma: PrismaClient,
  organizationId: string,
): Promise<OrgQuotaLimits> {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
  return resolveOrgQuotaLimits(org);
}

export async function getOrgQuotaUsage(
  prisma: PrismaClient,
  organizationId: string,
  now = new Date(),
): Promise<OrgQuotaUsage> {
  const { start, end } = utcMonthWindow(now);
  const [runsThisMonth, tokenAgg, agentsInstalled] = await Promise.all([
    prisma.run.count({
      where: {
        organizationId,
        createdAt: { gte: start, lt: end },
      },
    }),
    prisma.llmUsage.aggregate({
      where: {
        organizationId,
        createdAt: { gte: start, lt: end },
      },
      _sum: { inputTokens: true, outputTokens: true },
    }),
    prisma.tenantPackage.count({
      where: {
        organizationId,
        status: "installed",
        package: { kind: "agent" },
      },
    }),
  ]);
  const tokens =
    (tokenAgg._sum.inputTokens ?? 0) + (tokenAgg._sum.outputTokens ?? 0);
  return {
    runs_this_month: runsThisMonth,
    tokens_this_month: tokens,
    agents_installed: agentsInstalled,
  };
}

export type QuotaCheckResult =
  | { ok: true; limits: OrgQuotaLimits; usage: OrgQuotaUsage; reset_at: string }
  | {
      ok: false;
      quota: QuotaDimension;
      limit: number;
      used: number;
      reset_at: string;
      limits: OrgQuotaLimits;
      usage: OrgQuotaUsage;
    };

export async function assertRunsQuota(
  prisma: PrismaClient,
  organizationId: string,
): Promise<QuotaCheckResult> {
  const limits = await getOrgQuotaLimits(prisma, organizationId);
  const usage = await getOrgQuotaUsage(prisma, organizationId);
  const { resetAt } = utcMonthWindow();
  if (usage.runs_this_month >= limits.runs_per_month) {
    return {
      ok: false,
      quota: "runs_per_month",
      limit: limits.runs_per_month,
      used: usage.runs_this_month,
      reset_at: resetAt,
      limits,
      usage,
    };
  }
  return { ok: true, limits, usage, reset_at: resetAt };
}

export async function assertAgentsQuota(
  prisma: PrismaClient,
  organizationId: string,
): Promise<QuotaCheckResult> {
  const limits = await getOrgQuotaLimits(prisma, organizationId);
  const usage = await getOrgQuotaUsage(prisma, organizationId);
  const { resetAt } = utcMonthWindow();
  if (usage.agents_installed >= limits.max_agents_installed) {
    return {
      ok: false,
      quota: "max_agents_installed",
      limit: limits.max_agents_installed,
      used: usage.agents_installed,
      reset_at: resetAt,
      limits,
      usage,
    };
  }
  return { ok: true, limits, usage, reset_at: resetAt };
}

export async function assertTokensQuota(
  prisma: PrismaClient,
  organizationId: string,
): Promise<QuotaCheckResult> {
  const limits = await getOrgQuotaLimits(prisma, organizationId);
  const usage = await getOrgQuotaUsage(prisma, organizationId);
  const { resetAt } = utcMonthWindow();
  if (usage.tokens_this_month >= limits.tokens_per_month) {
    return {
      ok: false,
      quota: "tokens_per_month",
      limit: limits.tokens_per_month,
      used: usage.tokens_this_month,
      reset_at: resetAt,
      limits,
      usage,
    };
  }
  return { ok: true, limits, usage, reset_at: resetAt };
}

export async function updateOrgQuotas(
  prisma: PrismaClient,
  input: {
    organization_id: string;
    actor_user_id: string;
    plan_id?: PlanId;
    runs_per_month?: number | null;
    tokens_per_month?: number | null;
    max_agents_installed?: number | null;
    api_rpm?: number | null;
    reason?: string | null;
  },
): Promise<{ limits: OrgQuotaLimits; audit: QuotaAuditEntryPublic }> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: input.organization_id },
  });
  const previous = resolveOrgQuotaLimits(org);
  const updated = await prisma.organization.update({
    where: { id: input.organization_id },
    data: {
      ...(input.plan_id !== undefined ? { planId: input.plan_id } : {}),
      ...(input.runs_per_month !== undefined
        ? { quotaRunsPerMonth: input.runs_per_month }
        : {}),
      ...(input.tokens_per_month !== undefined
        ? { quotaTokensPerMonth: input.tokens_per_month }
        : {}),
      ...(input.max_agents_installed !== undefined
        ? { quotaMaxAgentsInstalled: input.max_agents_installed }
        : {}),
      ...(input.api_rpm !== undefined ? { quotaApiRpm: input.api_rpm } : {}),
    },
  });
  const next = resolveOrgQuotaLimits(updated);
  const auditRow = await prisma.quotaAuditEntryRow.create({
    data: {
      organizationId: input.organization_id,
      actorUserId: input.actor_user_id,
      previousValue: previous as unknown as Prisma.InputJsonValue,
      newValue: next as unknown as Prisma.InputJsonValue,
      reason: input.reason?.trim() ? input.reason.trim() : null,
    },
  });
  return {
    limits: next,
    audit: {
      id: auditRow.id,
      organization_id: auditRow.organizationId,
      actor_user_id: auditRow.actorUserId,
      previous_value: previous,
      new_value: next,
      reason: auditRow.reason,
      created_at: auditRow.createdAt.toISOString(),
    },
  };
}

export async function listQuotaAudit(
  prisma: PrismaClient,
  organizationId: string,
  limit = 50,
): Promise<QuotaAuditEntryPublic[]> {
  const rows = await prisma.quotaAuditEntryRow.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    organization_id: r.organizationId,
    actor_user_id: r.actorUserId,
    previous_value: r.previousValue as OrgQuotaLimits,
    new_value: r.newValue as OrgQuotaLimits,
    reason: r.reason,
    created_at: r.createdAt.toISOString(),
  }));
}
