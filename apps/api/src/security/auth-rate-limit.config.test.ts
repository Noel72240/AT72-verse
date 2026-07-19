/**
 * Phase 33 / ED5bis — auth rate limit config from env.
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { authRateLimitConfig } from "../quotas/rate-limit.redis.js";

describe("authRateLimitConfig (ED5bis)", () => {
  afterEach(() => {
    delete process.env.VERSE_AUTH_RL_LOGIN_LIMIT;
    delete process.env.VERSE_AUTH_RL_LOGIN_WINDOW_SEC;
    delete process.env.VERSE_AUTH_RL_INVITE_LIMIT;
    delete process.env.VERSE_AUTH_RL_WEBHOOK_LIMIT;
  });

  it("uses pack defaults when env unset", () => {
    const cfg = authRateLimitConfig();
    assert.equal(cfg.login.limit, 20);
    assert.equal(cfg.login.windowSec, 900);
    assert.equal(cfg.invite.limit, 30);
    assert.equal(cfg.webhook.limit, 120);
    assert.equal(cfg.webhook.windowSec, 60);
  });

  it("overrides from environment", () => {
    process.env.VERSE_AUTH_RL_LOGIN_LIMIT = "5";
    process.env.VERSE_AUTH_RL_LOGIN_WINDOW_SEC = "60";
    process.env.VERSE_AUTH_RL_INVITE_LIMIT = "10";
    process.env.VERSE_AUTH_RL_WEBHOOK_LIMIT = "50";
    const cfg = authRateLimitConfig();
    assert.equal(cfg.login.limit, 5);
    assert.equal(cfg.login.windowSec, 60);
    assert.equal(cfg.invite.limit, 10);
    assert.equal(cfg.webhook.limit, 50);
  });
});
