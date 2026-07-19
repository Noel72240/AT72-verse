import type {
  Bus,
  BusBroadcastOptions,
  BusHandler,
  BusMessage,
  BusPublishOptions,
  BusRequestOptions,
  BusSubscribeOptions,
  BusUnsubscribe,
} from "@at72-verse/contracts";
import { Redis } from "ioredis";
import { BusError } from "./errors.js";
import { RedisIdempotencyStore } from "./idempotency.js";
import { parseBusMessage, prepareMessageForPublish, serializeBusMessage } from "./message.js";
import { publishToDlq } from "./dlq.js";
import { TOPIC_DLQ } from "./topics.js";

export type RedisStreamsBusOptions = {
  redisUrl: string;
  /** Poll interval for consumer groups (ms). */
  pollIntervalMs?: number;
  sendToDlqOnHandlerError?: boolean;
  idempotencyTtlSeconds?: number;
};

type ActiveSubscription = {
  stop: boolean;
  loop: Promise<void>;
};

/**
 * Redis Streams Bus (ADR-003 / Decision X2).
 * Redis client is encapsulated here — never exported to hosts.
 */
export class RedisStreamsBus implements Bus {
  private readonly redis: Redis;
  private readonly pollIntervalMs: number;
  private readonly sendToDlqOnHandlerError: boolean;
  private readonly idempotency: RedisIdempotencyStore;
  private readonly active = new Map<string, ActiveSubscription>();
  private closed = false;

  constructor(options: RedisStreamsBusOptions) {
    this.redis = new Redis(options.redisUrl, {
      maxRetriesPerRequest: 2,
      lazyConnect: true,
    });
    this.pollIntervalMs = options.pollIntervalMs ?? 200;
    this.sendToDlqOnHandlerError = options.sendToDlqOnHandlerError ?? true;
    this.idempotency = new RedisIdempotencyStore(
      this.redis,
      "verse:bus:idem:",
      options.idempotencyTtlSeconds ?? 86_400,
    );
  }

  async connect(): Promise<void> {
    if (this.redis.status === "wait") {
      await this.redis.connect();
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    for (const sub of this.active.values()) {
      sub.stop = true;
    }
    await Promise.all([...this.active.values()].map((s) => s.loop.catch(() => undefined)));
    this.active.clear();
    await this.redis.quit().catch(() => this.redis.disconnect());
  }

  async publish(message: BusMessage, options: BusPublishOptions): Promise<void> {
    await this.connect();
    const frozen = prepareMessageForPublish(message);
    await this.redis.xadd(options.topic, "*", "payload", serializeBusMessage(frozen as BusMessage));
  }

  async subscribe(options: BusSubscribeOptions, handler: BusHandler): Promise<BusUnsubscribe> {
    await this.connect();
    const group = options.consumer_group ?? `verse-default`;
    const consumer = `c_${crypto.randomUUID().slice(0, 8)}`;
    const subId = crypto.randomUUID();

    try {
      await this.redis.xgroup("CREATE", options.topic, group, "0", "MKSTREAM");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("BUSYGROUP")) {
        throw new BusError("INTERNAL", `Failed to create consumer group: ${msg}`, {
          cause: err,
        });
      }
    }

    const state: ActiveSubscription = { stop: false, loop: Promise.resolve() };
    state.loop = this.consumeLoop(options.topic, group, consumer, handler, state);
    this.active.set(subId, state);

    return async () => {
      state.stop = true;
      await state.loop.catch(() => undefined);
      this.active.delete(subId);
    };
  }

  async request(_message: BusMessage, _options: BusRequestOptions): Promise<BusMessage> {
    throw new BusError(
      "UNAVAILABLE",
      "Bus.request is not implemented in Phase 10 (Decision T2). Use publish/subscribe.",
      { details: { operation: "request", phase: 10 } },
    );
  }

  async broadcast(_message: BusMessage, _options: BusBroadcastOptions): Promise<void> {
    throw new BusError(
      "UNAVAILABLE",
      "Bus.broadcast is not implemented in Phase 10 (Decision T2). Use publish/subscribe.",
      { details: { operation: "broadcast", phase: 10 } },
    );
  }

  private async consumeLoop(
    topic: string,
    group: string,
    consumer: string,
    handler: BusHandler,
    state: ActiveSubscription,
  ): Promise<void> {
    while (!state.stop && !this.closed) {
      try {
        const result = (await this.redis.xreadgroup(
          "GROUP",
          group,
          consumer,
          "COUNT",
          10,
          "BLOCK",
          this.pollIntervalMs,
          "STREAMS",
          topic,
          ">",
        )) as [string, [string, string[]][]][] | null;

        if (!result) continue;

        for (const [, entries] of result) {
          for (const [id, fields] of entries) {
            const raw = fieldValue(fields, "payload");
            if (!raw) {
              await this.redis.xack(topic, group, id);
              continue;
            }
            const message = parseBusMessage(raw);
            const frozen = prepareMessageForPublish(message);
            const claimKey = `${group}:${frozen.event_id}`;
            const claimed = await this.idempotency.tryClaim(claimKey);
            if (!claimed) {
              await this.redis.xack(topic, group, id);
              continue;
            }
            try {
              await handler(frozen as BusMessage);
              await this.redis.xack(topic, group, id);
            } catch (err) {
              if (this.sendToDlqOnHandlerError && topic !== TOPIC_DLQ) {
                const reason = err instanceof Error ? err.message : String(err);
                await publishToDlq(this, frozen as BusMessage, reason);
                await this.redis.xack(topic, group, id);
              } else {
                throw err;
              }
            }
          }
        }
      } catch (err) {
        if (state.stop || this.closed) return;
        // Brief backoff on transient errors
        await sleep(this.pollIntervalMs);
        if (err instanceof BusError && err.code === "INVALID_MESSAGE") {
          continue;
        }
      }
    }
  }
}

function fieldValue(fields: string[], key: string): string | undefined {
  for (let i = 0; i < fields.length; i += 2) {
    if (fields[i] === key) return fields[i + 1];
  }
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
