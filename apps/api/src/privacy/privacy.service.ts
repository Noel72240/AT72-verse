import {
  GoneException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  appendAuditEvent,
  clampAuditRetentionDays,
  clampSoftDeleteGraceDays,
  createAndCompleteExportJob,
  getExportJob,
  listOrgAuditEvents,
  purgeDueSoftDeletes,
  restoreOrganization,
  restoreUser,
  softDeleteOrganization,
  softDeleteUser,
  updateOrgRetention,
  type PrismaClient,
} from "@at72-verse/db";
import { getMetrics } from "@at72-verse/observability";
import { PRISMA } from "../auth/auth.tokens.js";
import { RbacService } from "../rbac/rbac.service.js";

/** EC10bis — soft-deleted resource addressed explicitly → 410. */
export function goneSoftDeleted(resource: string): never {
  throw new GoneException({
    code: "gone",
    message: `${resource} has been soft-deleted`,
  });
}

@Injectable()
export class PrivacyService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(RbacService) private readonly rbac: RbacService,
  ) {}

  /** Load org by id; 410 if soft-deleted, 404 if missing. */
  async requireActiveOrganization(organizationId: string) {
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) {
      throw new NotFoundException({ code: "not_found", message: "Organization not found" });
    }
    if (org.deletedAt) {
      goneSoftDeleted("Organization");
    }
    return org;
  }

  async listAudit(organizationId: string, userId: string) {
    await this.rbac.requireOrgRole(userId, organizationId, "ADMIN");
    await this.requireActiveOrganization(organizationId);
    return { events: await listOrgAuditEvents(this.prisma, organizationId) };
  }

  async requestUserExport(userId: string) {
    getMetrics().gdprExport.inc({ scope: "user" });
    const { job, payload } = await createAndCompleteExportJob(this.prisma, {
      scope: "user",
      user_id: userId,
    });
    return { job, payload };
  }

  async requestOrgExport(organizationId: string, userId: string) {
    await this.rbac.requireOrgRole(userId, organizationId, "OWNER");
    await this.requireActiveOrganization(organizationId);
    getMetrics().gdprExport.inc({ scope: "organization" });
    const { job, payload } = await createAndCompleteExportJob(this.prisma, {
      scope: "organization",
      user_id: userId,
      organization_id: organizationId,
    });
    return { job, payload };
  }

  async getExport(jobId: string, userId: string) {
    const result = await getExportJob(this.prisma, jobId, userId);
    if (!result.job) {
      throw new NotFoundException({ code: "not_found", message: "Export job not found" });
    }
    return result;
  }

  async softDeleteOrg(organizationId: string, userId: string) {
    await this.rbac.requireOrgRole(userId, organizationId, "OWNER", { allowDeleted: true });
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) {
      throw new NotFoundException({ code: "not_found", message: "Organization not found" });
    }
    if (org.deletedAt) {
      goneSoftDeleted("Organization");
    }
    const result = await softDeleteOrganization(this.prisma, {
      organization_id: organizationId,
      actor_user_id: userId,
    });
    getMetrics().softDelete.inc({ resource: "organization" });
    return result;
  }

  async restoreOrg(organizationId: string, userId: string) {
    await this.rbac.requireOrgRole(userId, organizationId, "OWNER", { allowDeleted: true });
    const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) {
      throw new NotFoundException({ code: "not_found", message: "Organization not found" });
    }
    if (!org.deletedAt) {
      throw new HttpException(
        { code: "invalid_input", message: "Organization is not soft-deleted" },
        HttpStatus.BAD_REQUEST,
      );
    }
    return restoreOrganization(this.prisma, {
      organization_id: organizationId,
      actor_user_id: userId,
    });
  }

  async softDeleteMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({ code: "not_found", message: "User not found" });
    }
    if (user.deletedAt) {
      goneSoftDeleted("User");
    }
    const result = await softDeleteUser(this.prisma, {
      user_id: userId,
      actor_user_id: userId,
    });
    getMetrics().softDelete.inc({ resource: "user" });
    return result;
  }

  async restoreMe(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException({ code: "not_found", message: "User not found" });
    }
    if (!user.deletedAt) {
      throw new HttpException(
        { code: "invalid_input", message: "User is not soft-deleted" },
        HttpStatus.BAD_REQUEST,
      );
    }
    try {
      return await restoreUser(this.prisma, {
        user_id: userId,
        actor_user_id: userId,
      });
    } catch (err) {
      throw new HttpException(
        {
          code: "invalid_input",
          message: err instanceof Error ? err.message : String(err),
        },
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  async updateRetention(
    organizationId: string,
    userId: string,
    body: { soft_delete_grace_days?: number; audit_retention_days?: number },
  ) {
    await this.rbac.requireOrgRole(userId, organizationId, "OWNER");
    await this.requireActiveOrganization(organizationId);
    if (body.audit_retention_days !== undefined) {
      const clamped = clampAuditRetentionDays(body.audit_retention_days);
      if (body.audit_retention_days < clamped) {
        throw new HttpException(
          {
            code: "invalid_input",
            message: "audit_retention_days minimum is 365",
          },
          HttpStatus.BAD_REQUEST,
        );
      }
    }
    if (body.soft_delete_grace_days !== undefined) {
      clampSoftDeleteGraceDays(body.soft_delete_grace_days);
    }
    const org = await updateOrgRetention(this.prisma, {
      organization_id: organizationId,
      actor_user_id: userId,
      soft_delete_grace_days: body.soft_delete_grace_days,
      audit_retention_days: body.audit_retention_days,
    });
    return {
      soft_delete_grace_days: org.softDeleteGraceDays,
      audit_retention_days: org.auditRetentionDays,
    };
  }

  /** Test / ops helper — purge soft-deletes past grace. */
  async runPurgeDue() {
    const result = await purgeDueSoftDeletes(this.prisma);
    if (result.orgs + result.users > 0) {
      getMetrics().purge.inc({ result: "ok" }, result.orgs + result.users);
    }
    return result;
  }
}
