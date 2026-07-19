import type { Bus } from "@at72-verse/contracts";
import { InMemoryBus } from "./in-memory-bus.js";
import { RedisStreamsBus, type RedisStreamsBusOptions } from "./redis-streams-bus.js";

export type CreateBusOptions =
  | { backend: "memory"; sendToDlqOnHandlerError?: boolean }
  | ({ backend: "redis" } & RedisStreamsBusOptions);

/**
 * Factory — hosts select backend; agents never call this (Decision Y1).
 */
export function createBus(options: CreateBusOptions = { backend: "memory" }): Bus {
  if (options.backend === "redis") {
    return new RedisStreamsBus(options);
  }
  return new InMemoryBus({
    sendToDlqOnHandlerError: options.sendToDlqOnHandlerError,
  });
}

/**
 * Resolve backend from env (REDIS_URL → redis, else memory).
 */
export function createBusFromEnv(env: NodeJS.ProcessEnv = process.env): Bus {
  const url = env.REDIS_URL;
  if (url && url.length > 0) {
    return createBus({ backend: "redis", redisUrl: url });
  }
  return createBus({ backend: "memory" });
}
