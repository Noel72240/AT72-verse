/**
 * Minimal seed for local / CI (Phase 04).
 * Creates one org, one user (owner), one workspace, and memberships.
 */
import { createPrismaClient } from "./client.js";
import {
  createMembership,
  createOrganization,
  createUser,
  createWorkspace,
  createWorkspaceMember,
} from "./tenancy.js";

const SEED_ORG_SLUG = "acme";
const SEED_USER_EMAIL = "owner@acme.example";
const SEED_WORKSPACE_SLUG = "default";

async function main(): Promise<void> {
  const db = createPrismaClient();

  try {
    const existing = await db.organization.findUnique({
      where: { slug: SEED_ORG_SLUG },
    });
    if (existing) {
      console.log(`Seed already applied (organization slug="${SEED_ORG_SLUG}").`);
      return;
    }

    const org = await createOrganization(db, {
      name: "Acme Demo",
      slug: SEED_ORG_SLUG,
    });
    const user = await createUser(db, {
      email: SEED_USER_EMAIL,
      displayName: "Acme Owner",
    });
    await createMembership(db, {
      organizationId: org.id,
      userId: user.id,
      role: "OWNER",
    });
    const workspace = await createWorkspace(db, {
      organizationId: org.id,
      name: "Default",
      slug: SEED_WORKSPACE_SLUG,
    });
    await createWorkspaceMember(db, {
      workspaceId: workspace.id,
      userId: user.id,
      role: "OWNER",
    });

    console.log("Seed OK:", {
      organizationId: org.id,
      userId: user.id,
      workspaceId: workspace.id,
    });
  } finally {
    await db.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exitCode = 1;
});
