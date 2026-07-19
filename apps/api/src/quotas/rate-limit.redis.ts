/**
 * Redis fixed-window limiter (Phase 31 org RPM · Phase 33 auth RL).
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

export async function checkFixedWindow(input: {
  key: string;
  limit: number;
  windowSec: number;
  metricScope: string;
}): Promise<RateLimitResult> {
  const { key, limit, windowSec, metricScope } = input;
  const now = Date.now();
  const windowStart = Math.floor(now / 1000 / windowSec) * windowSec;
  const resetAt = new Date((windowStart + windowSec) * 1000).toISOString();
  const fullKey = `${key}:${windowStart}`;

  const client = getRedis();
  if (!client) {
    if (failOpen() || !process.env.REDIS_URL) {
      return { allowed: true, remaining: limit, limit, reset_at: resetAt };
    }
    throw new Error("RATE_LIMIT_REDIS_UNAVAILABLE");
  }

  try {
    if (client.status !== "ready") {
      await client.connect().catch(() => undefined);
    }
    const count = await client.incr(fullKey);
    if (count === 1) {
      await client.expire(fullKey, windowSec + 1);
    }
    if (count > limit) {
      getMetrics().rateLimited.inc({ scope: metricScope });
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

export async function checkOrgApiRpm(
  organizationId: string,
  limit: number,
): Promise<RateLimitResult> {
  return checkFixedWindow({
    key: `verse:rl:org:${organizationId}`,
    limit,
    windowSec: 60,
    metricScope: "org",
  });
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/** Phase 33 / ED5bis — defaults from pack; override via env. */
export function authRateLimitConfig() {
  return {
    login: {
      limit: envInt("VERSE_AUTH_RL_LOGIN_LIMIT", 20),
      windowSec: envInt("VERSE_AUTH_RL_LOGIN_WINDOW_SEC", 900),
    },
    invite: {
      limit: envInt("VERSE_AUTH_RL_INVITE_LIMIT", 30),
      windowSec: envInt("VERSE_AUTH_RL_INVITE_WINDOW_SEC", 900),
    },
    webhook: {
      limit: envInt("VERSE_AUTH_RL_WEBHOOK_LIMIT", 120),
      windowSec: envInt("VERSE_AUTH_RL_WEBHOOK_WINDOW_SEC", 60),
    },
  };
}

export async function checkAuthRateLimit(
  kind: "login" | "invite" | "webhook",
  clientKey: string,
): Promise<RateLimitResult> {
  const cfg = authRateLimitConfig()[kind];
  return checkFixedWindow({
    key: `verse:rl:auth:${kind}:${clientKey}`,
    limit: cfg.limit,
    windowSec: cfg.windowSec,
    metricScope: `auth_${kind}`,
  });
}

/** Test helper. */
export function resetRateLimitClientForTests(): void {
  if (redis) {
    void redis.quit().catch(() => undefined);
  }
  redis = undefined;
}
