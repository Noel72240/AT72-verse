/**
 * Integration: login → /me → logout → /me 401 (Phase 05).
 * Requires DATABASE_URL (migrated Postgres). Skips otherwise.
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { DevAuthAdapter } from "@at72-verse/auth";
import { createPrismaClient, type PrismaClient } from "@at72-verse/db";
import { AppModule } from "./app.module.js";
import { AUTH_PROVIDER, PRISMA } from "./auth/auth.tokens.js";

const databaseUrl = process.env.DATABASE_URL;

describe("API auth flow (Phase 05)", { skip: !databaseUrl }, () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let devAuth: DevAuthAdapter;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `phase05-${suffix}@example.com`;

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
  });

  after(async () => {
    await app.close();
    await prisma.user.deleteMany({ where: { email } });
    await prisma.$disconnect();
  });

  it("health is public", async () => {
    const res = await request(app.getHttpServer()).get("/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "ok");
  });

  it("webhook clerk stub accepts POST", async () => {
    const res = await request(app.getHttpServer())
      .post("/webhooks/clerk")
      .send({ type: "user.created" });
    assert.equal(res.status, 201);
    assert.equal(res.body.status, "stub");
  });

  it("signup/login → /me → logout → unauthorized", async () => {
    const login = await request(app.getHttpServer())
      .post("/auth/dev/login")
      .send({
        email,
        displayName: "Phase 05 User",
        avatarUrl: "https://example.com/avatar.png",
        idpUserId: `clerk_dev_${suffix}`,
      });
    assert.equal(login.status, 201);
    assert.ok(login.body.accessToken);

    const me = await request(app.getHttpServer())
      .get("/me")
      .set("Authorization", `Bearer ${login.body.accessToken}`);
    assert.equal(me.status, 200);
    assert.equal(me.body.user.email, email);
    assert.equal(me.body.user.clerkUserId, `clerk_dev_${suffix}`);

    const me2 = await request(app.getHttpServer())
      .get("/me")
      .set("Authorization", `Bearer ${login.body.accessToken}`);
    assert.equal(me2.status, 200);
    assert.equal(me2.body.user.id, me.body.user.id);

    const logout = await request(app.getHttpServer())
      .post("/auth/logout")
      .set("Authorization", `Bearer ${login.body.accessToken}`);
    assert.equal(logout.status, 201);

    const meAfter = await request(app.getHttpServer())
      .get("/me")
      .set("Authorization", `Bearer ${login.body.accessToken}`);
    assert.equal(meAfter.status, 401);
  });
});
