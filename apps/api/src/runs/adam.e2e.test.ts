/**
 * Phase 12 — Adam dispatch + projection (requires DATABASE_URL).
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DevAuthAdapter } from "@at72-verse/auth";
import { createBus, type InMemoryBus } from "@at72-verse/bus";
import { startAgentRuntime, type RuntimeHandle } from "@at72-verse/agent-runtime";
import { createPrismaClient, type PrismaClient } from "@at72-verse/db";
import { createVerseCore } from "@at72-verse/verse-core";
import { AppModule } from "../app.module.js";
import { AUTH_PROVIDER, PRISMA } from "../auth/auth.tokens.js";
import { BUS } from "../core/bus.tokens.js";
import { VERSE_CORE } from "../core/core.tokens.js";

/** Mirrors Adam plan step names when no delegation occurs. */
const ADAM_PLAN_STEP_NAMES = [
  "analyze_goal",
  "draft_orchestration_plan",
  "aggregate_result",
] as const;

const databaseUrl = process.env.DATABASE_URL;

async function loginAs(app: INestApplication, email: string, idpUserId: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post("/auth/dev/login")
    .send({ email, displayName: email, idpUserId });
  assert.equal(res.status, 201);
  return res.body.accessToken as string;
}

describe("Adam runtime projection (Phase 12)", { skip: !databaseUrl }, () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let bus: InMemoryBus;
  let runtime: RuntimeHandle;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `adam-${suffix}@example.com`;
  let token: string;
  let orgId: string;
  let workspaceId: string;

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
    runtime = await startAgentRuntime({
      bus,
      consumerGroup: `e2e-runtime-${suffix}`,
    });

    token = await loginAs(app, email, `idp_adam_${suffix}`);
    await request(app.getHttpServer()).get("/me").set("Authorization", `Bearer ${token}`);

    const created = await request(app.getHttpServer())
      .post("/organizations")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Adam Org", slug: `adam-org-${suffix}` });
    assert.equal(created.status, 201);
    orgId = created.body.organization.id;
    workspaceId = created.body.workspace.id;
  });

  after(async () => {
    await runtime.stop();
    if (orgId) {
      await prisma.organization.deleteMany({ where: { id: orgId } });
    }
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
    await prisma.$disconnect();
  });

  it("Run target_agent=adam → Adam step completed + plan steps projected", async () => {
    const res = await request(app.getHttpServer())
      .post(`/workspaces/${workspaceId}/runs`)
      .set("Authorization", `Bearer ${token}`)
      .send({ target_agent: "adam", goal: "phase12-demo" });
    assert.equal(res.status, 201);
    const runId = res.body.run.id as string;

    const stepsRes = await request(app.getHttpServer())
      .get(`/runs/${runId}/steps`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(stepsRes.status, 200);
    const steps = stepsRes.body as Array<{
      id: string;
      name: string;
      status: string;
      agent_id: string | null;
      parent_step_id: string | null;
      seq: number;
    }>;

    assert.ok(steps.length >= 1 + ADAM_PLAN_STEP_NAMES.length);
    const adamStep = steps.find((s) => s.agent_id === "adam" && s.parent_step_id === null);
    assert.ok(adamStep);
    assert.equal(adamStep.status, "completed");

    const children = steps.filter((s) => s.parent_step_id === adamStep.id);
    assert.equal(children.length, ADAM_PLAN_STEP_NAMES.length);
    assert.deepEqual(
      children.map((c) => c.name),
      [...ADAM_PLAN_STEP_NAMES],
    );

    const runRes = await request(app.getHttpServer())
      .get(`/runs/${runId}`)
      .set("Authorization", `Bearer ${token}`);
    assert.ok(["running", "completed"].includes(runRes.body.status));
  });
});
