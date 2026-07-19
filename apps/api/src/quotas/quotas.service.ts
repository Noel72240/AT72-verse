import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  OrgQuotaLimits,
  OrgQuotaUsage,
  PlanId,
  QuotaAuditEntryPublic,
} from "@at72-verse/contracts";
import {
  assertAgentsQuota,
  assertRunsQuota,
  assertTokensQuota,
  getOrgQuotaLimits,
  getOrgQuotaUsage,
  isPlanId,
  listQuotaAudit,
  type PrismaClient,
  updateOrgQuotas,
  utcMonthWindow,
} from "@at72-verse/db";
import { getMetrics } from "@at72-verse/observability";
import { PRISMA } from "../auth/auth.tokens.js";
import { RbacService } from "../rbac/rbac.service.js";
import { checkOrgApiRpm } from "./rate-limit.redis.js";

function quotaExceededException(input: {
  quota: string;
  limit: number;
  used: number;
  reset_at: string;
}): HttpException {
  getMetrics().quotaExceeded.inc({ quota: input.quota });
  return new HttpException(
    {
      code: "QUOTA_EXCEEDED",
      message: `Quota exceeded: ${input.quota}`,
      quota: input.quota,
      limit: input.limit,
      used: input.used,
      reset_at: input.reset_at,
      upgrade_hint: "Upgrade your organization plan or ask an admin to raise quotas.",
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

@Injectable()
export class QuotasService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly rbac: RbacService,
  ) {}

  async getStatus(organizationId: string, userId: string): Promise<{
    limits: OrgQuotaLimits;
    usage: OrgQuotaUsage;
    reset_at: string;
  }> {
    await this.rbac.requireOrgMember(userId, organizationId);
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) {
      throw new NotFoundException({ code: "not_found", message: "Organization not found" });
    }
    const limits = await getOrgQuotaLimits(this.prisma, organizationId);
    const usage = await getOrgQuotaUsage(this.prisma, organizationId);
    return { limits, usage, reset_at: utcMonthWindow().resetAt };
  }

  async listAudit(
    organizationId: string,
    userId: string,
  ): Promise<{ entries: QuotaAuditEntryPublic[] }> {
    await this.rbac.requireOrgRole(userId, organizationId, "ADMIN");
    return { entries: await listQuotaAudit(this.prisma, organizationId) };
  }

  async putOverrides(
    organizationId: string,
    userId: string,
    body: {
      plan_id?: string;
      runs_per_month?: number | null;
      tokens_per_month?: number | null;
      max_agents_installed?: number | null;
      api_rpm?: number | null;
      reason?: string | null;
    },
  ): Promise<{ limits: OrgQuotaLimits; audit: QuotaAuditEntryPublic }> {
    await this.rbac.requireOrgRole(userId, organizationId, "OWNER");
    if (body.plan_id !== undefined && !isPlanId(body.plan_id)) {
      throw new HttpException(
        { code: "invalid_input", message: "plan_id must be free|pro|enterprise" },
        HttpStatus.BAD_REQUEST,
      );
    }
    for (const key of [
      "runs_per_month",
      "tokens_per_month",
      "max_agents_installed",
      "api_rpm",
    ] as const) {
      const v = body[key];
      if (v !== undefined && v !== null && (!Number.isFinite(v) || v < 1)) {
        throw new HttpException(
          { code: "invalid_input", message: `${key} must be a positive integer` },
          HttpStatus.BAD_REQUEST,
        );
      }
    }
    return updateOrgQuotas(this.prisma, {
      organization_id: organizationId,
      actor_user_id: userId,
      plan_id: body.plan_id as PlanId | undefined,
      runs_per_month: body.runs_per_month,
      tokens_per_month: body.tokens_per_month,
      max_agents_installed: body.max_agents_installed,
      api_rpm: body.api_rpm,
      reason: body.reason,
    });
  }

  /** EB4 — before createRun. */
  async assertCanCreateRun(organizationId: string): Promise<void> {
    const runs = await assertRunsQuota(this.prisma, organizationId);
    if (!runs.ok) {
      throw quotaExceededException(runs);
    }
    const tokens = await assertTokensQuota(this.prisma, organizationId);
    if (!tokens.ok) {
      throw quotaExceededException(tokens);
    }
    await this.assertApiRpm(organizationId);
  }

  /** EB4 — before installing an agent package. */
  async assertCanInstallAgent(organizationId: string, packageId: string): Promise<void> {
    const pkg = await this.prisma.package.findUnique({ where: { id: packageId } });
    if (pkg?.kind === "agent") {
      const agents = await assertAgentsQuota(this.prisma, organizationId);
      if (!agents.ok) {
        throw quotaExceededException(agents);
      }
    }
    await this.assertApiRpm(organizationId);
  }

  async assertApiRpm(organizationId: string): Promise<void> {
    const limits = await getOrgQuotaLimits(this.prisma, organizationId);
    try {
      const result = await checkOrgApiRpm(organizationId, limits.api_rpm);
      if (!result.allowed) {
        throw new HttpException(
          {
            code: "RATE_LIMITED",
            message: "API rate limit exceeded",
            limit: result.limit,
            reset_at: result.reset_at,
            retry_after: result.retry_after_sec,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        {
          code: "unavailable",
          message: "Rate limiter unavailable",
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}
