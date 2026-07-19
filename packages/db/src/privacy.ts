/**
 * Soft delete, platform audit, GDPR export (Phase 32 / EC*).
 */
import {
  AUDIT_RETENTION_DAYS_DEFAULT,
  AUDIT_RETENTION_DAYS_MIN,
  EXPORT_ARTIFACT_TTL_HOURS,
  SOFT_DELETE_GRACE_DAYS_DEFAULT,
  SOFT_DELETE_GRACE_DAYS_MAX,
  SOFT_DELETE_GRACE_DAYS_MIN,
  type AuditEventPublic,
  type ExportJobPublic,
  type ExportScope,
} from "@at72-verse/contracts";
import type { PrismaClient } from "./client.js";
import { PrismaNamespace as Prisma } from "./client.js";
import { getOrgQuotaLimits, getOrgQuotaUsage } from "./quotas.js";

export function clampSoftDeleteGraceDays(days: number): number {
  if (!Number.isFinite(days)) return SOFT_DELETE_GRACE_DAYS_DEFAULT;
  return Math.min(
    SOFT_DELETE_GRACE_DAYS_MAX,
    Math.max(SOFT_DELETE_GRACE_DAYS_MIN, Math.floor(days)),
  );
}

export function clampAuditRetentionDays(days: number): number {
  if (!Number.isFinite(days)) return AUDIT_RETENTION_DAYS_DEFAULT;
  return Math.max(AUDIT_RETENTION_DAYS_MIN, Math.floor(days));
}

export function notDeletedFilter<T extends { deletedAt?: Date | null }>(): {
  deletedAt: null;
} {
  return { deletedAt: null };
}

export async function appendAuditEvent(
  prisma: PrismaClient,
  input: {
    organization_id?: string | null;
    actor_user_id?: string | null;
    action: string;
    resource_type: string;
    resource_id?: string | null;
    metadata?: Record<string, unknown>;
  },
): Promise<AuditEventPublic> {
  const row = await prisma.auditEventRow.create({
    data: {
      organizationId: input.organization_id ?? null,
      actorUserId: input.actor_user_id ?? null,
      action: input.action,
      resourceType: input.resource_type,
      resourceId: input.resource_id ?? null,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
    },
  });
  return {
    id: row.id,
    organization_id: row.organizationId,
    actor_user_id: row.actorUserId,
    action: row.action,
    resource_type: row.resourceType,
    resource_id: row.resourceId,
    metadata: (row.metadata ?? {}) as Record<string, unknown>,
    created_at: row.createdAt.toISOString(),
  };
}

export async function listOrgAuditEvents(
  prisma: PrismaClient,
  organizationId: string,
  limit = 100,
): Promise<AuditEventPublic[]> {
  const rows = await prisma.auditEventRow.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    organization_id: r.organizationId,
    actor_user_id: r.actorUserId,
    action: r.action,
    resource_type: r.resourceType,
    resource_id: r.resourceId,
    metadata: (r.metadata ?? {}) as Record<string, unknown>,
    created_at: r.createdAt.toISOString(),
  }));
}

function addDays(from: Date, days: number): Date {
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000);
}

function toExportJobPublic(row: {
  id: string;
  organizationId: string | null;
  userId: string;
  scope: string;
  status: string;
  expiresAt: Date;
  completedAt: Date | null;
  createdAt: Date;
}): ExportJobPublic {
  return {
    id: row.id,
    organization_id: row.organizationId,
    user_id: row.userId,
    scope: row.scope as ExportScope,
    status: row.status as ExportJobPublic["status"],
    expires_at: row.expiresAt.toISOString(),
    completed_at: row.completedAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
  };
}

export async function softDeleteOrganization(
  prisma: PrismaClient,
  input: { organization_id: string; actor_user_id: string; now?: Date },
) {
  const now = input.now ?? new Date();
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: input.organization_id },
  });
  if (org.deletedAt) {
    return { organization: org, already_deleted: true as const };
  }
  const grace = clampSoftDeleteGraceDays(org.softDeleteGraceDays);
  const updated = await prisma.organization.update({
    where: { id: org.id },
    data: {
      deletedAt: now,
      purgeAfter: addDays(now, grace),
    },
  });
  await appendAuditEvent(prisma, {
    organization_id: org.id,
    actor_user_id: input.actor_user_id,
    action: "org.soft_delete",
    resource_type: "organization",
    resource_id: org.id,
    metadata: { purge_after: updated.purgeAfter?.toISOString(), grace_days: grace },
  });
  return { organization: updated, already_deleted: false as const };
}

export async function restoreOrganization(
  prisma: PrismaClient,
  input: { organization_id: string; actor_user_id: string },
) {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: input.organization_id },
  });
  if (!org.deletedAt) {
    return { organization: org, restored: false as const };
  }
  const updated = await prisma.organization.update({
    where: { id: org.id },
    data: { deletedAt: null, purgeAfter: null },
  });
  await appendAuditEvent(prisma, {
    organization_id: org.id,
    actor_user_id: input.actor_user_id,
    action: "org.restore",
    resource_type: "organization",
    resource_id: org.id,
    metadata: {},
  });
  return { organization: updated, restored: true as const };
}

export async function softDeleteUser(
  prisma: PrismaClient,
  input: { user_id: string; actor_user_id: string; grace_days?: number; now?: Date },
) {
  const now = input.now ?? new Date();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: input.user_id } });
  if (user.deletedAt) {
    return { user, already_deleted: true as const };
  }
  const grace = clampSoftDeleteGraceDays(
    input.grace_days ?? SOFT_DELETE_GRACE_DAYS_DEFAULT,
  );
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      deletedAt: now,
      purgeAfter: addDays(now, grace),
    },
  });
  await appendAuditEvent(prisma, {
    actor_user_id: input.actor_user_id,
    action: "user.soft_delete",
    resource_type: "user",
    resource_id: user.id,
    metadata: { purge_after: updated.purgeAfter?.toISOString(), grace_days: grace },
  });
  return { user: updated, already_deleted: false as const };
}

export async function restoreUser(
  prisma: PrismaClient,
  input: { user_id: string; actor_user_id: string },
) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: input.user_id } });
  if (!user.deletedAt) {
    return { user, restored: false as const };
  }
  if (user.anonymizedAt) {
    throw new Error("Cannot restore anonymized user");
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { deletedAt: null, purgeAfter: null },
  });
  await appendAuditEvent(prisma, {
    actor_user_id: input.actor_user_id,
    action: "user.restore",
    resource_type: "user",
    resource_id: user.id,
    metadata: {},
  });
  return { user: updated, restored: true as const };
}

export async function anonymizeUser(
  prisma: PrismaClient,
  input: { user_id: string; actor_user_id?: string | null; now?: Date },
) {
  const now = input.now ?? new Date();
  const user = await prisma.user.findUniqueOrThrow({ where: { id: input.user_id } });
  if (user.anonymizedAt) {
    return { user, already_anonymized: true as const };
  }
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      email: `deleted+${user.id}@invalid.local`,
      displayName: null,
      avatarUrl: null,
      clerkUserId: null,
      anonymizedAt: now,
      deletedAt: user.deletedAt ?? now,
    },
  });
  await appendAuditEvent(prisma, {
    actor_user_id: input.actor_user_id ?? null,
    action: "user.anonymize",
    resource_type: "user",
    resource_id: user.id,
    metadata: {},
  });
  return { user: updated, already_anonymized: false as const };
}

export async function updateOrgRetention(
  prisma: PrismaClient,
  input: {
    organization_id: string;
    actor_user_id: string;
    soft_delete_grace_days?: number;
    audit_retention_days?: number;
  },
) {
  const data: Prisma.OrganizationUpdateInput = {};
  if (input.soft_delete_grace_days !== undefined) {
    data.softDeleteGraceDays = clampSoftDeleteGraceDays(input.soft_delete_grace_days);
  }
  if (input.audit_retention_days !== undefined) {
    data.auditRetentionDays = clampAuditRetentionDays(input.audit_retention_days);
  }
  const updated = await prisma.organization.update({
    where: { id: input.organization_id },
    data,
  });
  await appendAuditEvent(prisma, {
    organization_id: input.organization_id,
    actor_user_id: input.actor_user_id,
    action: "retention.updated",
    resource_type: "organization",
    resource_id: input.organization_id,
    metadata: {
      soft_delete_grace_days: updated.softDeleteGraceDays,
      audit_retention_days: updated.auditRetentionDays,
    },
  });
  return updated;
}

/** Purge expired audit events beyond org retention (EC8bis). */
export async function purgeExpiredAuditEvents(
  prisma: PrismaClient,
  organizationId: string,
  now = new Date(),
): Promise<number> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
  });
  const days = clampAuditRetentionDays(org.auditRetentionDays);
  const cutoff = addDays(now, -days);
  const result = await prisma.auditEventRow.deleteMany({
    where: {
      organizationId,
      createdAt: { lt: cutoff },
    },
  });
  return result.count;
}

export async function hardPurgeOrganization(
  prisma: PrismaClient,
  organizationId: string,
): Promise<void> {
  // Keep audit_events (EC7) — null org FK via SetNull on delete, so reassign first.
  await prisma.auditEventRow.updateMany({
    where: { organizationId },
    data: { organizationId: null },
  });
  await prisma.organization.delete({ where: { id: organizationId } });
  await appendAuditEvent(prisma, {
    organization_id: null,
    action: "org.purge",
    resource_type: "organization",
    resource_id: organizationId,
    metadata: {},
  });
}

export async function hardPurgeUser(prisma: PrismaClient, userId: string): Promise<void> {
  await anonymizeUser(prisma, { user_id: userId });
  await prisma.membership.deleteMany({ where: { userId } });
  await prisma.workspaceMember.deleteMany({ where: { userId } });
  await appendAuditEvent(prisma, {
    actor_user_id: null,
    action: "user.purge",
    resource_type: "user",
    resource_id: userId,
    metadata: {},
  });
  // Keep user row anonymized (FK references) — do not hard-delete user id.
}

export async function purgeDueSoftDeletes(
  prisma: PrismaClient,
  now = new Date(),
): Promise<{ orgs: number; users: number }> {
  const dueOrgs = await prisma.organization.findMany({
    where: {
      deletedAt: { not: null },
      purgeAfter: { lte: now },
    },
    select: { id: true },
  });
  for (const org of dueOrgs) {
    await hardPurgeOrganization(prisma, org.id);
  }
  const dueUsers = await prisma.user.findMany({
    where: {
      deletedAt: { not: null },
      purgeAfter: { lte: now },
      anonymizedAt: null,
    },
    select: { id: true },
  });
  for (const user of dueUsers) {
    await hardPurgeUser(prisma, user.id);
  }
  return { orgs: dueOrgs.length, users: dueUsers.length };
}

async function buildUserExportPayload(prisma: PrismaClient, userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: { organization: { select: { id: true, name: true, slug: true, planId: true } } },
  });
  const conversations = await prisma.conversation.findMany({
    where: { createdByUserId: userId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
  const runs = await prisma.run.findMany({
    where: { createdByUserId: userId },
    select: {
      id: true,
      workspaceId: true,
      organizationId: true,
      status: true,
      createdAt: true,
      metadata: true,
    },
  });
  const memory = await prisma.memoryRecordRow.findMany({
    where: { userId },
    select: {
      id: true,
      organizationId: true,
      layer: true,
      scope: true,
      createdAt: true,
      deletedAt: true,
    },
  });
  const audits = await prisma.auditEventRow.findMany({
    where: { actorUserId: userId },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return {
    exported_at: new Date().toISOString(),
    scope: "user" as const,
    user: {
      id: user.id,
      email: user.email,
      display_name: user.displayName,
      created_at: user.createdAt.toISOString(),
    },
    memberships: memberships.map((m) => ({
      role: m.role,
      organization: m.organization,
    })),
    conversations: conversations.map((c) => ({
      id: c.id,
      organization_id: c.organizationId,
      workspace_id: c.workspaceId,
      title: c.title,
      created_at: c.createdAt.toISOString(),
      messages: c.messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        created_at: msg.createdAt.toISOString(),
      })),
    })),
    runs,
    memory_records: memory,
    audit_events: audits.map((a) => ({
      id: a.id,
      action: a.action,
      resource_type: a.resourceType,
      resource_id: a.resourceId,
      created_at: a.createdAt.toISOString(),
      metadata: a.metadata,
    })),
  };
}

/** Org export — EC6bis: conversation metadata only, no message bodies. */
async function buildOrgExportPayload(prisma: PrismaClient, organizationId: string) {
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
  const members = await prisma.membership.findMany({
    where: { organizationId },
    include: { user: { select: { id: true, email: true, displayName: true } } },
  });
  const workspaces = await prisma.workspace.findMany({
    where: { organizationId },
    select: { id: true, name: true, slug: true, createdAt: true },
  });
  const packages = await prisma.tenantPackage.findMany({
    where: { organizationId },
    select: {
      packageId: true,
      pinnedVersion: true,
      status: true,
      installedAt: true,
    },
  });
  const limits = await getOrgQuotaLimits(prisma, organizationId);
  const usage = await getOrgQuotaUsage(prisma, organizationId);
  const audits = await listOrgAuditEvents(prisma, organizationId, 1000);
  const conversations = await prisma.conversation.findMany({
    where: { organizationId },
    select: {
      id: true,
      workspaceId: true,
      title: true,
      createdByUserId: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  });
  return {
    exported_at: new Date().toISOString(),
    scope: "organization" as const,
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      plan_id: org.planId,
      soft_delete_grace_days: org.softDeleteGraceDays,
      audit_retention_days: org.auditRetentionDays,
      created_at: org.createdAt.toISOString(),
    },
    members: members.map((m) => ({
      role: m.role,
      user_id: m.user.id,
      email: m.user.email,
      display_name: m.user.displayName,
    })),
    workspaces,
    packages,
    quotas: { limits, usage },
    audit_events: audits,
    conversations_metadata: conversations.map((c) => ({
      id: c.id,
      workspace_id: c.workspaceId,
      title: c.title,
      created_by_user_id: c.createdByUserId,
      message_count: c._count.messages,
      created_at: c.createdAt.toISOString(),
      updated_at: c.updatedAt.toISOString(),
    })),
  };
}

export async function createAndCompleteExportJob(
  prisma: PrismaClient,
  input: {
    scope: ExportScope;
    user_id: string;
    organization_id?: string | null;
  },
): Promise<{ job: ExportJobPublic; payload: unknown }> {
  const expiresAt = addDays(new Date(), EXPORT_ARTIFACT_TTL_HOURS / 24);
  const job = await prisma.exportJobRow.create({
    data: {
      scope: input.scope,
      userId: input.user_id,
      organizationId: input.organization_id ?? null,
      status: "pending",
      expiresAt,
    },
  });
  await appendAuditEvent(prisma, {
    organization_id: input.organization_id ?? null,
    actor_user_id: input.user_id,
    action: "export.requested",
    resource_type: "export_job",
    resource_id: job.id,
    metadata: { scope: input.scope },
  });
  try {
    const payload =
      input.scope === "user"
        ? await buildUserExportPayload(prisma, input.user_id)
        : await buildOrgExportPayload(prisma, input.organization_id!);
    const completed = await prisma.exportJobRow.update({
      where: { id: job.id },
      data: {
        status: "completed",
        payload: payload as Prisma.InputJsonValue,
        completedAt: new Date(),
      },
    });
    await appendAuditEvent(prisma, {
      organization_id: input.organization_id ?? null,
      actor_user_id: input.user_id,
      action: "export.completed",
      resource_type: "export_job",
      resource_id: job.id,
      metadata: { scope: input.scope },
    });
    return { job: toExportJobPublic(completed), payload };
  } catch (err) {
    await prisma.exportJobRow.update({
      where: { id: job.id },
      data: {
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      },
    });
    throw err;
  }
}

export async function getExportJob(
  prisma: PrismaClient,
  jobId: string,
  requesterUserId: string,
): Promise<{ job: ExportJobPublic | null; payload: unknown | null }> {
  const job = await prisma.exportJobRow.findUnique({ where: { id: jobId } });
  if (!job || job.userId !== requesterUserId) {
    return { job: null, payload: null };
  }
  if (job.expiresAt.getTime() < Date.now() && job.status === "completed") {
    const expired = await prisma.exportJobRow.update({
      where: { id: job.id },
      data: { status: "expired", payload: Prisma.DbNull },
    });
    return { job: toExportJobPublic(expired), payload: null };
  }
  return {
    job: toExportJobPublic(job),
    payload: job.status === "completed" ? job.payload : null,
  };
}
