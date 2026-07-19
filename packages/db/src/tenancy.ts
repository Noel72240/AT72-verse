/**
 * Tenancy CRUD helpers (Phase 04).
 * Domain APIs arrive in Phase 06; these functions are the schema exercise + test surface.
 */
import type { OrgRole, PrismaClient, WorkspaceRole } from "@prisma/client";

export type CreateOrganizationInput = {
  name: string;
  slug: string;
};

export type CreateUserInput = {
  email: string;
  displayName?: string | null;
  clerkUserId?: string | null;
};

export type CreateMembershipInput = {
  organizationId: string;
  userId: string;
  role?: OrgRole;
};

export type CreateWorkspaceInput = {
  organizationId: string;
  name: string;
  slug: string;
};

export type CreateWorkspaceMemberInput = {
  workspaceId: string;
  userId: string;
  role?: WorkspaceRole;
};

export async function createOrganization(db: PrismaClient, input: CreateOrganizationInput) {
  return db.organization.create({
    data: {
      name: input.name,
      slug: input.slug,
    },
  });
}

export async function getOrganizationById(db: PrismaClient, id: string) {
  return db.organization.findUnique({ where: { id } });
}

export async function updateOrganizationName(db: PrismaClient, id: string, name: string) {
  return db.organization.update({
    where: { id },
    data: { name },
  });
}

export async function deleteOrganization(db: PrismaClient, id: string) {
  return db.organization.delete({ where: { id } });
}

export async function createUser(db: PrismaClient, input: CreateUserInput) {
  return db.user.create({
    data: {
      email: input.email,
      displayName: input.displayName ?? null,
      clerkUserId: input.clerkUserId ?? null,
    },
  });
}

export async function getUserByEmail(db: PrismaClient, email: string) {
  return db.user.findUnique({ where: { email } });
}

export async function createMembership(db: PrismaClient, input: CreateMembershipInput) {
  return db.membership.create({
    data: {
      organizationId: input.organizationId,
      userId: input.userId,
      role: input.role ?? "VIEWER",
    },
  });
}

export async function createWorkspace(db: PrismaClient, input: CreateWorkspaceInput) {
  return db.workspace.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      slug: input.slug,
    },
  });
}

/**
 * Adds a workspace member. Copies `organizationId` from the workspace so every
 * business row carries `organization_id` (ARCHITECTURE §15.4 / §23.2).
 */
export async function createWorkspaceMember(db: PrismaClient, input: CreateWorkspaceMemberInput) {
  const workspace = await db.workspace.findUniqueOrThrow({
    where: { id: input.workspaceId },
    select: { id: true, organizationId: true },
  });

  return db.workspaceMember.create({
    data: {
      organizationId: workspace.organizationId,
      workspaceId: workspace.id,
      userId: input.userId,
      role: input.role ?? "VIEWER",
    },
  });
}

export async function listWorkspacesForOrganization(db: PrismaClient, organizationId: string) {
  return db.workspace.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
  });
}
