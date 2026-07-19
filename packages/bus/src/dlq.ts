import type { Bus, BusMessage } from "@at72-verse/contracts";
import { TOPIC_DLQ } from "./topics.js";

export type DlqEnqueueHook = (info: {
  run_id: string | null;
  reason_bytes: number;
}) => void;

let dlqHook: DlqEnqueueHook | undefined;

export function setDlqEnqueueHook(hook: DlqEnqueueHook | undefined): void {
  dlqHook = hook;
}

/**
 * Publish a dead-letter entry (W1). Envelope shape is identical to normal BusMessage.
 * Original message is nested in payload for diagnostics; unknown fields remain allowed.
 */
export async function publishToDlq(bus: Bus, original: BusMessage, reason: string): Promise<void> {
  const dlqMessage: BusMessage = {
    event_id: crypto.randomUUID(),
    correlation_id: original.correlation_id,
    causation_id: original.event_id,
    tenant_id: original.tenant_id,
    workspace_id: original.workspace_id,
    run_id: original.run_id,
    timestamp: new Date().toISOString(),
    version: "1",
    event_type: "system.dlq.dead_letter",
    payload: {
      reason,
      original,
    },
  };

  await bus.publish(dlqMessage, { topic: TOPIC_DLQ });
  dlqHook?.({
    run_id: original.run_id ?? null,
    reason_bytes: Buffer.byteLength(reason, "utf8"),
  });
}
