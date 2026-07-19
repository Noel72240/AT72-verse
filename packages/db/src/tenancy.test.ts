/**
 * Integration CRUD tests for tenancy schema (Phase 04).
 * Requires DATABASE_URL pointing at a migrated Postgres (local Docker or CI service).
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { PrismaClient } from "@prisma/client";
import { createPrismaClient } from "./client.js";
import {
  createMembership,
  createOrganization,
  createUser,
  createWorkspace,
  createWorkspaceMember,
  deleteOrganization,
  getOrganizationById,
  getUserByEmail,
  listWorkspacesForOrganization,
  updateOrganizationName,
} from "./tenancy.js";

const databaseUrl = process.env.DATABASE_URL;

describe("@at72-verse/db tenancy CRUD", { skip: !databaseUrl }, () => {
  let db: PrismaClient;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  before(async () => {
    db = createPrismaClient(databaseUrl);
    await db.$connect();
  });

  after(async () => {
    await db.$disconnect();
  });

  it("creates, reads, updates, deletes an organization", async () => {
    const org = await createOrganization(db, {
      name: "Temp Org",
      slug: `temp-org-${suffix}`,
    });
    assert.ok(org.id);
    assert.equal(org.slug, `temp-org-${suffix}`);

    const fetched = await getOrganizationById(db, org.id);
    assert.equal(fetched?.name, "Temp Org");

    const updated = await updateOrganizationName(db, org.id, "Temp Org Renamed");
    assert.equal(updated.name, "Temp Org Renamed");

    await deleteOrganization(db, org.id);
    assert.equal(await getOrganizationById(db, org.id), null);
  });

  it("enforces organization_id on workspaces and workspace_members", async () => {
    const org = await createOrganization(db, {
      name: "Tenant Org",
      slug: `tenant-${suffix}`,
    });
    const user = await createUser(db, {
      email: `user-${suffix}@example.com`,
      displayName: "Tenant User",
    });
    const membership = await createMembership(db, {
      organizationId: org.id,
      userId: user.id,
      role: "ADMIN",
    });
    assert.equal(membership.organizationId, org.id);

    const workspace = await createWorkspace(db, {
      organizationId: org.id,
      name: "Main",
      slug: "main",
    });
    assert.equal(workspace.organizationId, org.id);

    const member = await createWorkspaceMember(db, {
      workspaceId: workspace.id,
      userId: user.id,
      role: "EDITOR",
    });
    assert.equal(member.organizationId, org.id);
    assert.equal(member.workspaceId, workspace.id);

    const workspaces = await listWorkspacesForOrganization(db, org.id);
    assert.equal(workspaces.length, 1);
    assert.equal(workspaces[0]?.id, workspace.id);

    const foundUser = await getUserByEmail(db, `user-${suffix}@example.com`);
    assert.equal(foundUser?.id, user.id);

    await deleteOrganization(db, org.id);
    // Users are global identities — org delete does not remove the user row.
    assert.ok(await getUserByEmail(db, `user-${suffix}@example.com`));
    await db.user.delete({ where: { id: user.id } });
  });

  it("rejects duplicate org membership for the same user", async () => {
    const org = await createOrganization(db, {
      name: "Dup Org",
      slug: `dup-${suffix}`,
    });
    const user = await createUser(db, {
      email: `dup-${suffix}@example.com`,
    });
    await createMembership(db, {
      organizationId: org.id,
      userId: user.id,
      role: "OWNER",
    });

    await assert.rejects(
      () =>
        createMembership(db, {
          organizationId: org.id,
          userId: user.id,
          role: "VIEWER",
        }),
      /Unique constraint|unique/i,
    );

    await deleteOrganization(db, org.id);
    await db.user.delete({ where: { id: user.id } });
  });
});
