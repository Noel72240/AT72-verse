/**
 * Workspace capability grants (Phase 20 · Phase 29 HITL).
 */
import type { CapabilityKind, PermissionGrant } from "@at72-verse/contracts";
import { FIRST_PARTY_CAPABILITY_DEFAULTS } from "@at72-verse/contracts";
import type { PrismaClient } from "./client.js";

function toGrant(row: {
  id: string;
  organizationId: string;
  workspaceId: string;
  kind: string;
  capabilityId: string;
  enabled: boolean;
  requireApproval: boolean;
  createdAt: Date;
  updatedAt: Date;
}): PermissionGrant {
  return {
    id: row.id,
    organization_id: row.organizationId,
    workspace_id: row.workspaceId,
    kind: row.kind as CapabilityKind,
    capability_id: row.capabilityId,
    enabled: row.enabled,
    require_approval: row.requireApproval,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function ensureFirstPartyCapabilityGrants(
  prisma: PrismaClient,
  organizationId: string,
  workspaceId: string,
): Promise<PermissionGrant[]> {
  for (const seed of FIRST_PARTY_CAPABILITY_DEFAULTS) {
    const existing = await prisma.capabilityGrant.findUnique({
      where: {
        workspaceId_kind_capabilityId: {
          workspaceId,
          kind: seed.kind,
          capabilityId: seed.capability_id,
        },
      },
    });
    if (!existing) {
      await prisma.capabilityGrant.create({
        data: {
          organizationId,
          workspaceId,
          kind: seed.kind,
          capabilityId: seed.capability_id,
          enabled: seed.enabled,
          requireApproval: seed.require_approval ?? false,
        },
      });
    }
  }
  return listCapabilityGrants(prisma, organizationId, workspaceId);
}

export async function listCapabilityGrants(
  prisma: PrismaClient,
  organizationId: string,
  workspaceId: string,
): Promise<PermissionGrant[]> {
  const rows = await prisma.capabilityGrant.findMany({
    where: { organizationId, workspaceId },
    orderBy: [{ kind: "asc" }, { capabilityId: "asc" }],
  });
  return rows.map(toGrant);
}

export async function upsertCapabilityGrant(
  prisma: PrismaClient,
  input: {
    organization_id: string;
    workspace_id: string;
    kind: CapabilityKind;
    capability_id: string;
    enabled: boolean;
    require_approval?: boolean;
  },
): Promise<PermissionGrant> {
  const row = await prisma.capabilityGrant.upsert({
    where: {
      workspaceId_kind_capabilityId: {
        workspaceId: input.workspace_id,
        kind: input.kind,
        capabilityId: input.capability_id,
      },
    },
    create: {
      organizationId: input.organization_id,
      workspaceId: input.workspace_id,
      kind: input.kind,
      capabilityId: input.capability_id,
      enabled: input.enabled,
      requireApproval: input.require_approval ?? false,
    },
    update: {
      enabled: input.enabled,
      ...(input.require_approval !== undefined
        ? { requireApproval: input.require_approval }
        : {}),
    },
  });
  return toGrant(row);
}
