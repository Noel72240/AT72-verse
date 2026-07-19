/**
 * Phase 11 runs isolation (requires DATABASE_URL + migrations).
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DevAuthAdapter } from "@at72-verse/auth";
import { createBus, type InMemoryBus } from "@at72-verse/bus";
import { createPrismaClient, type PrismaClient } from "@at72-verse/db";
import { createVerseCore } from "@at72-verse/verse-core";
import { AppModule } from "../app.module.js";
import { AUTH_PROVIDER, PRISMA } from "../auth/auth.tokens.js";
import { BUS } from "../core/bus.tokens.js";
import { VERSE_CORE } from "../core/core.tokens.js";

const databaseUrl = process.env.DATABASE_URL;

async function loginAs(app: INestApplication, email: string, idpUserId: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post("/auth/dev/login")
    .send({ email, displayName: email, idpUserId });
  assert.equal(res.status, 201);
  return res.body.accessToken as string;
}

describe("Runs isolation (Phase 11)", { skip: !databaseUrl }, () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let bus: InMemoryBus;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const emailA = `run-a-${suffix}@example.com`;
  const emailB = `run-b-${suffix}@example.com`;
  let tokenA: string;
  let tokenB: string;
  let orgId: string;
  let workspaceId: string;
  let runId: string;

  before(async () => {
    prisma = createPrismaClient(databaseUrl);
    bus = createBus({ backend: "memory" }) as InMemoryBus;
    const core = createVerseCore({ bus, kernelBackend: "stub" });
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AUTH_PROVIDER)
      .useValue(new DevAuthAdapter())
      .overrideProvider(PRISMA)
      .useValue(prisma)
      .overrideProvider(BUS)
      .useValue(bus)
      .overrideProvider(VERSE_CORE)
      .useValue(core)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();

    tokenA = await loginAs(app, emailA, `idp_run_a_${suffix}`);
    tokenB = await loginAs(app, emailB, `idp_run_b_${suffix}`);
    await request(app.getHttpServer()).get("/me").set("Authorization", `Bearer ${tokenA}`);
    await request(app.getHttpServer()).get("/me").set("Authorization", `Bearer ${tokenB}`);

    const created = await request(app.getHttpServer())
      .post("/organizations")
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ name: "Runs Org", slug: `runs-org-${suffix}` });
    assert.equal(created.status, 201);
    orgId = created.body.organization.id;
    workspaceId = created.body.workspace.id;
  });

  after(async () => {
    if (orgId) {
      await prisma.organization.deleteMany({ where: { id: orgId } });
    }
    await prisma.user.deleteMany({
      where: { email: { in: [emailA, emailB] } },
    });
    await app.close();
    await prisma.$disconnect();
  });

  it("creates a manual run with bootstrap step and lists steps", async () => {
    const res = await request(app.getHttpServer())
      .post(`/workspaces/${workspaceId}/runs`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ metadata: { source: "phase11-test" } });
    assert.equal(res.status, 201);
    assert.equal(res.body.run.status, "queued");
    assert.ok(res.body.run.created_at);
    assert.equal(res.body.run.conversation_id, null);
    assert.equal(res.body.steps.length, 1);
    assert.equal(res.body.steps[0].seq, 1);
    runId = res.body.run.id;

    const steps = await request(app.getHttpServer())
      .get(`/runs/${runId}/steps`)
      .set("Authorization", `Bearer ${tokenA}`);
    assert.equal(steps.status, 200);
    assert.equal(steps.body.length, 1);

    const published = bus.getPublished("verse.runs.created");
    assert.ok(published.length >= 1);
    assert.equal(published[published.length - 1]?.run_id, runId);
  });

  it("technical PATCH status enforces transitions", async () => {
    const bad = await request(app.getHttpServer())
      .patch(`/runs/${runId}/status`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ status: "completed" });
    assert.equal(bad.status, 400);

    const running = await request(app.getHttpServer())
      .patch(`/runs/${runId}/status`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ status: "running" });
    assert.equal(running.status, 200);
    assert.equal(running.body.status, "running");
    assert.ok(running.body.started_at);

    const done = await request(app.getHttpServer())
      .patch(`/runs/${runId}/status`)
      .set("Authorization", `Bearer ${tokenA}`)
      .send({ status: "completed" });
    assert.equal(done.status, 200);
    assert.equal(done.body.status, "completed");
  });

  it("User B cannot read User A run (tenant isolation)", async () => {
    const res = await request(app.getHttpServer())
      .get(`/runs/${runId}`)
      .set("Authorization", `Bearer ${tokenB}`);
    assert.equal(res.status, 404);
  });
});
