/**
 * Phase 15 — Adam → Nova delegation + projection (requires DATABASE_URL).
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DevAuthAdapter } from "@at72-verse/auth";
import { createBus, type InMemoryBus } from "@at72-verse/bus";
import {
  createDefaultAgentRegistry,
  startAgentRuntime,
  type AgentPlugin,
  type RuntimeHandle,
} from "@at72-verse/agent-runtime";
import { createPrismaClient, type PrismaClient } from "@at72-verse/db";
import {
  createNoopAdapters,
  createVerseCore,
  ManagedLlmAdapter,
  type LlmProviderAdapter,
  type ProviderCompleteInput,
  type VerseCore,
} from "@at72-verse/verse-core";
import { AppModule } from "../app.module.js";
import { AUTH_PROVIDER, PRISMA } from "../auth/auth.tokens.js";
import { BUS } from "../core/bus.tokens.js";
import { VERSE_CORE } from "../core/core.tokens.js";

const databaseUrl = process.env.DATABASE_URL;

class OrchestrationFakeProvider implements LlmProviderAdapter {
  readonly id = "openai";
  async complete(input: ProviderCompleteInput) {
    const joined = input.messages.map((m) => m.content).join("\n");
    const system = input.messages.find((m) => m.role === "system")?.content ?? "";
    if (system.includes("Adam") || system.includes("orchestrator")) {
      return {
        content: JSON.stringify({
          delegate_to: "nova",
          brief: "Rédige un post LinkedIn professionnel sur AT72 Verse",
          summary: "Delegate LinkedIn writing to Nova",
        }),
        input_tokens: 8,
        output_tokens: 20,
      };
    }
    return {
      content: `LinkedIn draft from harness.\n\nTopic: ${joined.slice(0, 60)}`,
      input_tokens: 10,
      output_tokens: 40,
    };
  }
}

async function loginAs(app: INestApplication, email: string, idpUserId: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post("/auth/dev/login")
    .send({ email, displayName: email, idpUserId });
  assert.equal(res.status, 201);
  return res.body.accessToken as string;
}

async function waitFor(
  check: () => Promise<boolean>,
  options?: { timeoutMs?: number; intervalMs?: number },
): Promise<void> {
  const timeoutMs = options?.timeoutMs ?? 8000;
  const intervalMs = options?.intervalMs ?? 50;
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error("waitFor timeout");
}

function buildCore(bus: InMemoryBus): VerseCore {
  const llm = new ManagedLlmAdapter({
    bus,
    provider: new OrchestrationFakeProvider(),
    credentials: { platformApiKey: "test-key" },
  });
  return createVerseCore({
    bus,
    adapters: { ...createNoopAdapters(), llm },
    kernelBackend: "core",
  });
}

describe("Adam → Nova orchestration happy path (Phase 15)", { skip: !databaseUrl }, () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let bus: InMemoryBus;
  let runtime: RuntimeHandle;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `orch-ok-${suffix}@example.com`;
  let token: string;
  let orgId: string;
  let workspaceId: string;

  before(async () => {
    prisma = createPrismaClient(databaseUrl);
    bus = createBus({ backend: "memory" }) as InMemoryBus;
    const core = buildCore(bus);
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
      core,
      consumerGroup: `e2e-orch-ok-${suffix}`,
    });

    token = await loginAs(app, email, `idp_orch_ok_${suffix}`);
    await request(app.getHttpServer()).get("/me").set("Authorization", `Bearer ${token}`);

    const created = await request(app.getHttpServer())
      .post("/organizations")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Orch Org", slug: `orch-ok-${suffix}` });
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

  it("happy path: Adam → Nova → timeline with parent_step_id", async () => {
    const res = await request(app.getHttpServer())
      .post(`/workspaces/${workspaceId}/runs`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        target_agent: "adam",
        goal: "Rédige un post LinkedIn sur AT72 Verse",
      });
    assert.equal(res.status, 201);
    const runId = res.body.run.id as string;

    await waitFor(async () => {
      const stepsRes = await request(app.getHttpServer())
        .get(`/runs/${runId}/steps`)
        .set("Authorization", `Bearer ${token}`);
      const steps = stepsRes.body as Array<{
        id: string;
        agent_id: string | null;
        parent_step_id: string | null;
        status: string;
      }>;
      const adam = steps.find((s) => s.agent_id === "adam" && s.parent_step_id === null);
      const nova = steps.find((s) => s.agent_id === "nova" && s.parent_step_id === adam?.id);
      return Boolean(adam?.status === "completed" && nova?.status === "completed");
    });

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
      output: Record<string, unknown> | null;
    }>;

    const adamStep = steps.find((s) => s.agent_id === "adam" && s.parent_step_id === null);
    assert.ok(adamStep);
    assert.equal(adamStep.status, "completed");

    const novaStep = steps.find((s) => s.agent_id === "nova" && s.parent_step_id === adamStep.id);
    assert.ok(novaStep, "Nova step must be child of Adam via parent_step_id");
    assert.equal(novaStep.status, "completed");
    assert.match(novaStep.name, /nova/);

    const adamOut = adamStep.output as { result?: { content?: string } } | null;
    assert.equal(typeof adamOut?.result?.content, "string");
    assert.ok(String(adamOut?.result?.content).length > 0);
  });
});

describe("Adam → Nova failure cascade (Phase 15)", { skip: !databaseUrl }, () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let bus: InMemoryBus;
  let runtime: RuntimeHandle;
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `orch-fail-${suffix}@example.com`;
  let token: string;
  let orgId: string;
  let workspaceId: string;

  before(async () => {
    prisma = createPrismaClient(databaseUrl);
    bus = createBus({ backend: "memory" }) as InMemoryBus;
    const core = buildCore(bus);

    const base = createDefaultAgentRegistry();
    const failingNova: AgentPlugin = {
      id: "nova",
      tools_allowlist: ["web-search", "file-read-write"],
      handleTask: async () => {
        throw new Error("Nova simulated failure");
      },
    };
    const registry = new Map(base);
    registry.set("nova", failingNova);

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
      core,
      registry,
      consumerGroup: `e2e-orch-fail-${suffix}`,
    });

    token = await loginAs(app, email, `idp_orch_fail_${suffix}`);
    await request(app.getHttpServer()).get("/me").set("Authorization", `Bearer ${token}`);

    const created = await request(app.getHttpServer())
      .post("/organizations")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Orch Fail Org", slug: `orch-fail-${suffix}` });
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

  it("échec Nova → Adam failed → Run failed", async () => {
    const res = await request(app.getHttpServer())
      .post(`/workspaces/${workspaceId}/runs`)
      .set("Authorization", `Bearer ${token}`)
      .send({
        target_agent: "adam",
        goal: "Rédige un post LinkedIn (fail path)",
      });
    assert.equal(res.status, 201);
    const runId = res.body.run.id as string;

    await waitFor(async () => {
      const runRes = await request(app.getHttpServer())
        .get(`/runs/${runId}`)
        .set("Authorization", `Bearer ${token}`);
      return runRes.body.status === "failed";
    });

    const runRes = await request(app.getHttpServer())
      .get(`/runs/${runId}`)
      .set("Authorization", `Bearer ${token}`);
    assert.equal(runRes.body.status, "failed");

    const stepsRes = await request(app.getHttpServer())
      .get(`/runs/${runId}/steps`)
      .set("Authorization", `Bearer ${token}`);
    const steps = stepsRes.body as Array<{
      id: string;
      agent_id: string | null;
      parent_step_id: string | null;
      status: string;
    }>;
    const adamStep = steps.find((s) => s.agent_id === "adam" && s.parent_step_id === null);
    const novaStep = steps.find((s) => s.agent_id === "nova");
    assert.ok(adamStep);
    assert.equal(adamStep.status, "failed");
    assert.ok(novaStep);
    assert.equal(novaStep.status, "failed");
    assert.equal(novaStep.parent_step_id, adamStep.id);
  });
});
