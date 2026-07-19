/**
 * Public health check without Postgres (always runs in CI).
 */
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { DevAuthAdapter } from "@at72-verse/auth";
import { AppModule } from "./app.module.js";
import { AUTH_PROVIDER, PRISMA } from "./auth/auth.tokens.js";

describe("API health (no database)", () => {
  let app: INestApplication;

  before(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(AUTH_PROVIDER)
      .useValue(new DevAuthAdapter())
      .overrideProvider(PRISMA)
      .useValue({})
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  after(async () => {
    await app.close();
  });

  it("GET /health returns ok", async () => {
    const res = await request(app.getHttpServer()).get("/health");
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "ok");
    assert.equal(res.body.phase, 14);
  });

  it("GET /health/core returns structured Core health", async () => {
    const res = await request(app.getHttpServer()).get("/health/core");
    assert.equal(res.status, 200);
    assert.equal(res.body.status, "ok");
    assert.ok(typeof res.body.version === "string");
    assert.ok(typeof res.body.uptime_ms === "number");
    assert.ok(Array.isArray(res.body.modules));
    assert.ok(res.body.modules.length >= 1);
    assert.ok(Array.isArray(res.body.adapters));
    assert.ok(["stub", "core"].includes(res.body.kernel_backend));
  });
});
