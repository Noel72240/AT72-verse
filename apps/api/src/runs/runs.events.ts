import { randomUUID } from "node:crypto";
import type { Bus, BusMessage } from "@at72-verse/bus";
import { runsTopic } from "@at72-verse/bus";
import type { Run as ContractRun } from "@at72-verse/contracts";

/**
 * Publish verse.runs.* after persistence (AG1). Never touches Redis directly.
 * Envelope always carries the same run_id for end-to-end tracing.
 */
export async function publishRunEvent(
  bus: Bus,
  eventSuffix: string,
  run: ContractRun,
  extraPayload: Record<string, unknown> = {},
): Promise<void> {
  const message: BusMessage = {
    event_id: randomUUID(),
    correlation_id: run.id,
    causation_id: run.id,
    tenant_id: run.organization_id,
    workspace_id: run.workspace_id,
    run_id: run.id,
    timestamp: new Date().toISOString(),
    version: "1",
    event_type: `run.${eventSuffix}`,
    payload: {
      run,
      ...extraPayload,
    },
  };
  await bus.publish(message, { topic: runsTopic(eventSuffix) });
}
