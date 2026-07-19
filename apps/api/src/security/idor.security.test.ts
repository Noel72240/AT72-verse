/**
 * Phase 33 / ED4 — IDOR guards on privacy & quotas (requires DATABASE_URL).
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
  assert.ok(res.status === 200 || res.status === 201);
  return res.body.accessToken as string;
}

describe("IDOR isolation (Phase 33 / ED4)", { skip: !databaseUrl }, () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let tokenA: string;
  let tokenB: string;
  let orgA: string;
  let exportJobA: string;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  before(async () => {
    prisma = createPrismaClient(databaseUrl);
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AUTH_PROVIDER)
      .useValue(new DevAuthAdapter())
      .overrideProvider(PRISMA)
      .useValue(prisma)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    tokenA = await loginAs(app, `idor-a-${suffix}@example.com`, `idp_idor_a_${suffix}`);
    tokenB = await loginAs(app, `idor-b-${suffix}@example.com`, `idp_idor_b_${suffix}`);
    await request(app.getHttpServer()).get("/me").set("Authorization", `Bearer ${tokenA}`);
    await request(app.getHttpServer()).get("/me").set("Authorization", `Bearer ${tokenB}`);

    const created = await request(app.getHttpServer())
      .post("/organizations")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "IDOR Org A", slug: `idor-a-${suffix}` });
    assert.ok(created.status === 200 || created.status === 201);
    orgA = created.body.organization.id;

    const exp = await request(app.getHttpServer())
      .post("/me/export")
      .set("Authorization", `Bearer ${tokenA}`);
    assert.ok(exp.status === 200 || exp.status === 201);
    exportJobA = exp.body.job.id as string;
  });

  after(async () => {
    if (orgA) await prisma.organization.deleteMany({ where: { id: orgA } });
    await prisma.user.deleteMany({
      where: { email: { contains: `idor-` } },
    });
    await app.close();
    await prisma.$disconnect();
  });

  it("User B cannot read User A export job", async () => {
    const res = await request(app.getHttpServer())
      .get(`/me/export/${exportJobA}`)
      .set("Authorization", `Bearer ${tokenB}`);
    assert.equal(res.status, 404);
  });

  it("User B cannot read Org A quotas", async () => {
    const res = await request(app.getHttpServer())
      .get(`/organizations/${orgA}/quotas`)
      .set("Authorization", `Bearer ${tokenB}`);
    assert.ok(res.status === 403 || res.status === 404);
  });

  it("User B cannot read Org A audit events", async () => {
    const res = await request(app.getHttpServer())
      .get(`/organizations/${orgA}/audit-events`)
      .set("Authorization", `Bearer ${tokenB}`);
    assert.ok(res.status === 403 || res.status === 404);
  });

  it("User B cannot export Org A", async () => {
    const res = await request(app.getHttpServer())
      .post(`/organizations/${orgA}/export`)
      .set("Authorization", `Bearer ${tokenB}`);
    assert.ok(res.status === 403 || res.status === 404);
  });
});
