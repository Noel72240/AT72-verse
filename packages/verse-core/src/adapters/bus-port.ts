/**
 * Core BusAdapter that delegates to `@at72-verse/bus` (Phase 10 / S1 · Z1).
 */
import { randomUUID } from "node:crypto";
import type { Bus, BusMessage, KernelContext } from "@at72-verse/contracts";
import type { AdapterHealth, BusAdapter } from "./ports.js";

export function createBusPortAdapter(bus: Bus, options?: { name?: string }): BusAdapter {
  const name = options?.name ?? "package-bus";
  return {
    name,
    async health(): Promise<AdapterHealth> {
      return {
        name,
        kind: "bus",
        status: "ok",
        detail: "delegates to @at72-verse/bus",
      };
    },
    async publish(
      topic: string,
      payload: Record<string, unknown>,
      context: KernelContext,
    ): Promise<void> {
      const eventType = typeof payload.event_type === "string" ? payload.event_type : topic;
      const message: BusMessage = {
        event_id: randomUUID(),
        correlation_id: context.trace_id,
        causation_id: context.span_id,
        tenant_id: context.organization_id,
        workspace_id: context.workspace_id,
        run_id: context.run_id,
        timestamp: new Date().toISOString(),
        version: "1",
        event_type: eventType,
        payload,
      };
      await bus.publish(message, { topic });
    },
  };
}
