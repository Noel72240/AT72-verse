/**
 * Phase 06 isolation + RBAC (requires DATABASE_URL + migrations).
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DevAuthAdapter } from "@at72-verse/auth";
import { createPrismaClient, type PrismaClient } from "@at72-verse/db";
import { AppModule } from "../app.module.js";
import { AUTH_PROVIDER, PRISMA } from "../auth/auth.tokens.js";

const databaseUrl = process.env.DATABASE_URL;

async function loginAs(app: INestApplication, email: string, idpUserId: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post("/auth/dev/login")
    .send({ email, displayName: email, idpUserId });
  assert.equal(res.status, 201);
  return res.body.accessToken as string;
}

describe("Tenancy isolation & RBAC (Phase 06)", { skip: !databaseUrl }, () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let devAuth: DevAuthAdapter;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const emailA = `owner-a-${suffix}@example.com`;
  const emailB = `user-b-${suffix}@example.com`;
  const emailEditor = `editor-${suffix}@example.com`;
  let tokenA: string;
  let tokenB: string;
  let tokenEditor: string;
  let orgId: string;
  let workspaceId: string;

  before(async () => {
    prisma = createPrismaClient(databaseUrl);
    devAuth = new DevAuthAdapter();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AUTH_PROVIDER)
      .useValue(devAuth)
      .overrideProvider(PRISMA)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    tokenA = await loginAs(app, emailA, `idp_a_${suffix}`);
    tokenB = await loginAs(app, emailB, `idp_b_${suffix}`);
    tokenEditor = await loginAs(app, emailEditor, `idp_e_${suffix}`);

    // Materialize users via /me
    await request(app.getHttpServer()).get("/me").set("Authorization", `Bearer ${tokenA}`);
    await request(app.getHttpServer()).get("/me").set("Authorization", `Bearer ${tokenB}`);
    await request(app.getHttpServer()).get("/me").set("Authorization", `Bearer ${tokenEditor}`);

    const created = await request(app.getHttpServer())
      .post("/organizations")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Org A", slug: `org-a-${suffix}` });
    assert.equal(created.status, 201);
    orgId = created.body.organization.id;
    workspaceId = created.body.workspace.id;
  });

  after(async () => {
    if (orgId) {
      await prisma.organization.deleteMany({ where: { id: orgId } });
    }
    await prisma.user.deleteMany({
      where: { email: { in: [emailA, emailB, emailEditor] } },
    });
    await app.close();
    await prisma.$disconnect();
  });

  it("User B cannot list User A organization workspaces", async () => {
    const res = await request(app.getHttpServer())
      .get(`/organizations/${orgId}/workspaces`)
      .set("Authorization", `Bearer ${tokenB}`);
    assert.equal(res.status, 403);
  });

  it("User B cannot get User A workspace by id", async () => {
    const res = await request(app.getHttpServer())
      .get(`/workspaces/${workspaceId}`)
      .set("Authorization", `Bearer ${tokenB}`);
    assert.equal(res.status, 404);
  });

  it("EDITOR cannot create invitations (RBAC)", async () => {
    // Invite editor as EDITOR via owner, accept, then try invite
    const invite = await request(app.getHttpServer())
      .post(`/organizations/${orgId}/invitations`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ email: emailEditor, role: "EDITOR" });
    assert.equal(invite.status, 201);
    const token = invite.body.token as string;

    const accepted = await request(app.getHttpServer())
      .post(`/invitations/${token}/accept`)
      .set("Authorization", `Bearer ${tokenEditor}`);
    assert.equal(accepted.status, 201);

    const denied = await request(app.getHttpServer())
      .post(`/organizations/${orgId}/invitations`)
      .set("Authorization", `Bearer ${tokenEditor}`)
      .send({ email: emailB, role: "VIEWER" });
    assert.equal(denied.status, 403);
  });

  it("invitation is single-use; reissue keeps history", async () => {
    const first = await request(app.getHttpServer())
      .post(`/organizations/${orgId}/invitations`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ email: emailB, role: "VIEWER" });
    assert.equal(first.status, 201);
    const token1 = first.body.token as string;

    const second = await request(app.getHttpServer())
      .post(`/organizations/${orgId}/invitations`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ email: emailB, role: "VIEWER" });
    assert.equal(second.status, 201);
    const token2 = second.body.token as string;
    assert.notEqual(token1, token2);

    const revoked = await prisma.invitation.findUnique({ where: { token: token1 } });
    assert.equal(revoked?.status, "REVOKED");

    const acceptOld = await request(app.getHttpServer())
      .post(`/invitations/${token1}/accept`)
      .set("Authorization", `Bearer ${tokenB}`);
    assert.equal(acceptOld.status, 410);

    const acceptNew = await request(app.getHttpServer())
      .post(`/invitations/${token2}/accept`)
      .set("Authorization", `Bearer ${tokenB}`);
    assert.equal(acceptNew.status, 201);

    const acceptAgain = await request(app.getHttpServer())
      .post(`/invitations/${token2}/accept`)
      .set("Authorization", `Bearer ${tokenB}`);
    assert.equal(acceptAgain.status, 409);

    const listed = await request(app.getHttpServer())
      .get(`/organizations/${orgId}/workspaces`)
      .set("Authorization", `Bearer ${tokenB}`);
    assert.equal(listed.status, 200);
    assert.ok(Array.isArray(listed.body));
  });
});
