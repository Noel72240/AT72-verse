/**
 * Phase 31 — Redis RPM limiter fail-open / fail-closed (no Redis).
 */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { checkOrgApiRpm, resetRateLimitClientForTests } from "./rate-limit.redis.js";

describe("checkOrgApiRpm without REDIS_URL", () => {
  afterEach(() => {
    delete process.env.REDIS_URL;
    delete process.env.VERSE_RATE_LIMIT_FAIL_OPEN;
    resetRateLimitClientForTests();
  });

  it("allows traffic when Redis is not configured (local soft mode)", async () => {
    delete process.env.REDIS_URL;
    resetRateLimitClientForTests();
    const result = await checkOrgApiRpm("org-test", 60);
    assert.equal(result.allowed, true);
    if (result.allowed) {
      assert.equal(result.limit, 60);
      assert.equal(result.remaining, 60);
    }
  });
});
