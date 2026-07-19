/**
 * Generic Bus API surface (ADR-003).
 * Implementation lives in `@at72-verse/bus` — contracts only define the shape.
 */
import type { BusMessage } from "./bus-message.js";

export type BusTopic = string;

export type BusHandler = (message: BusMessage) => void | Promise<void>;

export type BusUnsubscribe = () => void | Promise<void>;

export interface BusPublishOptions {
  topic: BusTopic;
}

export interface BusSubscribeOptions {
  topic: BusTopic;
  consumer_group?: string;
}

export interface BusRequestOptions {
  topic: BusTopic;
  reply_topic?: BusTopic;
  timeout_ms?: number;
}

export interface BusBroadcastOptions {
  topic: BusTopic;
}

export interface Bus {
  publish(message: BusMessage, options: BusPublishOptions): Promise<void>;
  subscribe(options: BusSubscribeOptions, handler: BusHandler): Promise<BusUnsubscribe>;
  request(message: BusMessage, options: BusRequestOptions): Promise<BusMessage>;
  broadcast(message: BusMessage, options: BusBroadcastOptions): Promise<void>;
}
