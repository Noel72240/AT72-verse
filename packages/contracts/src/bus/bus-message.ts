import type { IsoDateTime, UlidOrUuid } from "../common/primitives.js";

/**
 * Normalized bus envelope (ADR-003).
 * Canonical name: BusMessage.
 * Roadmap alias: MessageEnvelope.
 */
export interface BusMessage {
  event_id: UlidOrUuid;
  correlation_id: UlidOrUuid;
  causation_id: UlidOrUuid;
  tenant_id: string;
  workspace_id: string;
  /** Null when the message is outside a run context. */
  run_id: string | null;
  /** UTC ISO-8601 timestamp. */
  timestamp: IsoDateTime;
  /** Event payload schema version (semver or integer string). */
  version: string;
  event_type: string;
  payload: Record<string, unknown>;
}

/** Roadmap / legacy name — identical to {@link BusMessage}. */
export type MessageEnvelope = BusMessage;

export type BusMessageKind = "command" | "event" | "query" | "response";

/**
 * Optional extension fields (backward-compatible; consumers may ignore).
 */
export interface BusMessageExtensions {
  message_kind?: BusMessageKind;
  source_agent?: string;
  target_agent?: string;
  priority?: number;
  authz?: {
    actor_user_id?: string;
    grants_snapshot?: Record<string, unknown>;
  };
  budget?: {
    max_tokens?: number;
    max_cost_usd?: number;
    deadline_at?: IsoDateTime;
  };
}

export type BusMessageWithExtensions = BusMessage & BusMessageExtensions;
