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
import { BusError } from "./errors.js";
import { type IdempotencyStore, MemoryIdempotencyStore } from "./idempotency.js";
import { prepareMessageForPublish } from "./message.js";
import { publishToDlq } from "./dlq.js";
import { TOPIC_DLQ } from "./topics.js";

type Subscription = {
  id: string;
  topic: string;
  consumerGroup: string;
  handler: BusHandler;
  idempotency: IdempotencyStore;
};

/**
 * In-memory Bus (Decision X2) — behavioural parity with RedisStreamsBus for publish/subscribe.
 */
export class InMemoryBus implements Bus {
  private readonly topics = new Map<string, Readonly<BusMessage>[]>();
  private readonly subscriptions = new Map<string, Subscription>();
  private readonly sendToDlqOnHandlerError: boolean;

  constructor(options?: { sendToDlqOnHandlerError?: boolean }) {
    this.sendToDlqOnHandlerError = options?.sendToDlqOnHandlerError ?? true;
  }

  async publish(message: BusMessage, options: BusPublishOptions): Promise<void> {
    const frozen = prepareMessageForPublish(message);
    const list = this.topics.get(options.topic) ?? [];
    list.push(frozen);
    this.topics.set(options.topic, list);

    const subs = [...this.subscriptions.values()].filter((s) => s.topic === options.topic);
    for (const sub of subs) {
      await this.dispatch(sub, frozen);
    }
  }

  async subscribe(options: BusSubscribeOptions, handler: BusHandler): Promise<BusUnsubscribe> {
    const id = crypto.randomUUID();
    const consumerGroup = options.consumer_group ?? `solo_${id}`;
    const sub: Subscription = {
      id,
      topic: options.topic,
      consumerGroup,
      handler,
      idempotency: new MemoryIdempotencyStore(),
    };
    this.subscriptions.set(id, sub);

    // Replay existing messages for late subscribers (in-memory parity aid for tests).
    const existing = this.topics.get(options.topic) ?? [];
    for (const msg of existing) {
      await this.dispatch(sub, msg);
    }

    return async () => {
      this.subscriptions.delete(id);
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

  /** Test helper — messages stored for a topic (frozen). */
  getPublished(topic: string): readonly Readonly<BusMessage>[] {
    return this.topics.get(topic) ?? [];
  }

  private async dispatch(sub: Subscription, message: Readonly<BusMessage>): Promise<void> {
    const key = `${sub.consumerGroup}:${message.event_id}`;
    const claimed = await sub.idempotency.tryClaim(key);
    if (!claimed) return;

    try {
      await sub.handler(message as BusMessage);
    } catch (err) {
      if (this.sendToDlqOnHandlerError && sub.topic !== TOPIC_DLQ) {
        const reason = err instanceof Error ? err.message : String(err);
        await publishToDlq(this, message as BusMessage, reason);
      } else {
        throw err;
      }
    }
  }
}
