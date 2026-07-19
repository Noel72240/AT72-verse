/**
 * Redis fixed-window RPM limiter (Phase 31 / EB6-A).
 * Fail-closed by default when Redis is required but unavailable.
 */
import { Redis } from "ioredis";
import { getMetrics } from "@at72-verse/observability";

export type RateLimitResult =
  | { allowed: true; remaining: number; limit: number; reset_at: string }
  | {
      allowed: false;
      remaining: 0;
      limit: number;
      reset_at: string;
      retry_after_sec: number;
    };

let redis: Redis | null | undefined;

function failOpen(): boolean {
  return process.env.VERSE_RATE_LIMIT_FAIL_OPEN === "1";
}

function getRedis(): Redis | null {
  if (redis !== undefined) return redis;
  const url = process.env.REDIS_URL;
  if (!url) {
    redis = null;
    return null;
  }
  redis = new Redis(url, {
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    lazyConnect: true,
  });
  return redis;
}

export async function checkOrgApiRpm(
  organizationId: string,
  limit: number,
): Promise<RateLimitResult> {
  const windowSec = 60;
  const now = Date.now();
  const windowStart = Math.floor(now / 1000 / windowSec) * windowSec;
  const resetAt = new Date((windowStart + windowSec) * 1000).toISOString();
  const key = `verse:rl:org:${organizationId}:${windowStart}`;

  const client = getRedis();
  if (!client) {
    if (failOpen() || !process.env.REDIS_URL) {
      // No Redis configured (memory bus local) — allow with soft remaining.
      return { allowed: true, remaining: limit, limit, reset_at: resetAt };
    }
    throw new Error("RATE_LIMIT_REDIS_UNAVAILABLE");
  }

  try {
    if (client.status !== "ready") {
      await client.connect().catch(() => undefined);
    }
    const count = await client.incr(key);
    if (count === 1) {
      await client.expire(key, windowSec + 1);
    }
    if (count > limit) {
      getMetrics().rateLimited.inc({ scope: "org" });
      return {
        allowed: false,
        remaining: 0,
        limit,
        reset_at: resetAt,
        retry_after_sec: Math.max(1, windowStart + windowSec - Math.floor(now / 1000)),
      };
    }
    return {
      allowed: true,
      remaining: Math.max(0, limit - count),
      limit,
      reset_at: resetAt,
    };
  } catch {
    if (failOpen()) {
      return { allowed: true, remaining: limit, limit, reset_at: resetAt };
    }
    throw new Error("RATE_LIMIT_REDIS_UNAVAILABLE");
  }
}

/** Test helper. */
export function resetRateLimitClientForTests(): void {
  if (redis) {
    void redis.quit().catch(() => undefined);
  }
  redis = undefined;
}
