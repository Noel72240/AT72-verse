import type { BusMessage } from "@at72-verse/contracts";
import { BusError } from "./errors.js";

function assertNonEmpty(value: unknown, field: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new BusError("INVALID_MESSAGE", `BusMessage.${field} is required`, {
      details: { field },
    });
  }
}

/**
 * Validate required envelope fields (including schema `version`) then deep-freeze.
 * Extra/unknown fields are preserved (handlers must ignore them safely).
 */
export function prepareMessageForPublish(message: BusMessage): Readonly<BusMessage> {
  assertNonEmpty(message.event_id, "event_id");
  assertNonEmpty(message.correlation_id, "correlation_id");
  assertNonEmpty(message.causation_id, "causation_id");
  assertNonEmpty(message.tenant_id, "tenant_id");
  assertNonEmpty(message.workspace_id, "workspace_id");
  assertNonEmpty(message.timestamp, "timestamp");
  assertNonEmpty(message.version, "version");
  assertNonEmpty(message.event_type, "event_type");
  if (message.payload === null || typeof message.payload !== "object") {
    throw new BusError("INVALID_MESSAGE", "BusMessage.payload must be an object", {
      details: { field: "payload" },
    });
  }

  return deepFreeze(structuredClone(message)) as Readonly<BusMessage>;
}

export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const key of Object.keys(value as object)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

/** Parse JSON while keeping unknown fields (forward-compatible consumers). */
export function parseBusMessage(raw: string): BusMessage {
  const parsed = JSON.parse(raw) as BusMessage;
  return parsed;
}

export function serializeBusMessage(message: BusMessage): string {
  return JSON.stringify(message);
}
