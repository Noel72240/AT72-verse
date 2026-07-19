/**
 * Memory Gateway adapter — exposes Gateway as MemoryAdapter for health / façade parity.
 * Kernel remember/recall go through MemoryGateway directly (not this thin wrapper's store).
 */
import type {
  KernelContext,
  MemoryRecallRequest,
  MemoryRecord,
  MemoryRememberRequest,
} from "@at72-verse/contracts";
import type { AdapterHealth, MemoryAdapter } from "../adapters/ports.js";
import type { MemoryGateway } from "./memory-gateway.js";

export class MemoryGatewayAdapter implements MemoryAdapter {
  readonly name = "memory-gateway";

  constructor(private readonly gateway: MemoryGateway) {}

  async health(): Promise<AdapterHealth> {
    return {
      name: this.name,
      kind: "memory",
      status: "ok",
      detail: "Phase 25 Memory Gateway (L1/L2/L4 + semantic)",
    };
  }

  remember(request: MemoryRememberRequest, context: KernelContext): Promise<MemoryRecord> {
    return this.gateway.remember(request, context);
  }

  recall(request: MemoryRecallRequest, context: KernelContext): Promise<MemoryRecord[]> {
    return this.gateway.recall(request, context);
  }
}
