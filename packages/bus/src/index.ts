/**
 * @at72-verse/bus — generic Bus API (ADR-003, Phase 10).
 *
 * Redis Streams client is encapsulated in adapters — never import ioredis from hosts.
 * Agents/skills must not import this package (Phase 09 boundaries).
 */
export type {
  Bus,
  BusBroadcastOptions,
  BusHandler,
  BusMessage,
  BusPublishOptions,
  BusRequestOptions,
  BusSubscribeOptions,
  BusTopic,
  BusUnsubscribe,
  MessageEnvelope,
} from "@at72-verse/contracts";

export { BusError, type BusErrorCode } from "./errors.js";
export { createBus, createBusFromEnv, type CreateBusOptions } from "./create-bus.js";
export { InMemoryBus } from "./in-memory-bus.js";
export { RedisStreamsBus, type RedisStreamsBusOptions } from "./redis-streams-bus.js";
export { publishToDlq, setDlqEnqueueHook, type DlqEnqueueHook } from "./dlq.js";
export {
  TOPIC_DLQ,
  TOPIC_PREFIX_RUNS,
  TOPIC_PREFIX_AGENT,
  TOPIC_PREFIX_SYSTEM,
  TOPIC_PREFIX_AUDIT,
  TOPIC_PREFIX_METRICS,
  TOPIC_PREFIX_LLM,
  RESERVED_TOPIC_PREFIXES,
  runsTopic,
  agentTasksTopic,
  agentEventsTopic,
  approvalsResumeTopic,
  systemTopic,
  auditTopic,
  metricsTopic,
  llmTopic,
  isReservedTopic,
} from "./topics.js";
export { prepareMessageForPublish } from "./message.js";
export {
  MemoryIdempotencyStore,
  RedisIdempotencyStore,
  type IdempotencyStore,
} from "./idempotency.js";

export const packageName = "@at72-verse/bus" as const;
