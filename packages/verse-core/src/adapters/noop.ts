import { createHash } from "node:crypto";
import type {
  KernelContext,
  LlmCompleteRequest,
  LlmCompletion,
  LlmEmbedRequest,
  LlmEmbedding,
  MemoryRecallRequest,
  MemoryRecord,
  MemoryRememberRequest,
} from "@at72-verse/contracts";
import { deterministicEmbedding } from "../memory/deterministic-embedding.js";
import { MEMORY_EMBEDDING_DIMS } from "../memory/vector-index-port.js";
import type {
  AdapterHealth,
  BusAdapter,
  DatabaseAdapter,
  LlmAdapter,
  MemoryAdapter,
  ObjectStorageAdapter,
  VectorAdapter,
  VerseCoreAdapters,
} from "./ports.js";

function hash(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

function noopHealth(name: string, kind: string): AdapterHealth {
  return { name, kind, status: "noop", detail: "Phase 08 no-op adapter" };
}

export class NoopLlmAdapter implements LlmAdapter {
  readonly name = "noop-llm";

  async health(): Promise<AdapterHealth> {
    return noopHealth(this.name, "llm");
  }

  async complete(request: LlmCompleteRequest, context: KernelContext): Promise<LlmCompletion> {
    const joined = request.messages.map((m) => m.content).join("\n");
    const digest = hash({
      profile: request.profile,
      joined,
      run: context.run_id,
    }).slice(0, 16);
    const content = `[core-noop:${request.profile}] ${digest} :: ${joined.slice(0, 120)}`;
    const tokens = Math.max(1, joined.trim().split(/\s+/).filter(Boolean).length);
    return {
      content,
      llm_call_id: `noop_${digest}`,
      usage: {
        input_tokens: tokens,
        output_tokens: Math.max(1, content.trim().split(/\s+/).length),
        credential_source: "platform",
      },
    };
  }

  async embed(request: LlmEmbedRequest, _context: KernelContext): Promise<LlmEmbedding> {
    const inputs = Array.isArray(request.input) ? request.input : [request.input];
    return {
      vectors: inputs.map((text) => deterministicEmbedding(text, MEMORY_EMBEDDING_DIMS)),
    };
  }
}

export class NoopMemoryAdapter implements MemoryAdapter {
  readonly name = "noop-memory";
  private readonly store = new Map<string, MemoryRecord>();

  async health(): Promise<AdapterHealth> {
    return noopHealth(this.name, "memory");
  }

  async remember(request: MemoryRememberRequest, context: KernelContext): Promise<MemoryRecord> {
    const id = `mem_${hash({
      run: context.run_id,
      scope: request.scope,
      content: request.content,
    }).slice(0, 24)}`;
    const record: MemoryRecord = {
      id,
      scope: request.scope,
      content: request.content,
      layer: "L1",
      type: "ephemeral",
      organization_id: context.organization_id,
      workspace_id: context.workspace_id,
      run_id: context.run_id,
      conversation_id: context.conversation_id ?? null,
      user_id: context.user_id,
      agent_id: context.agent_id,
      trace_id: context.trace_id,
      created_at: new Date().toISOString(),
    };
    this.store.set(id, record);
    return record;
  }

  async recall(request: MemoryRecallRequest, context: KernelContext): Promise<MemoryRecord[]> {
    const q = request.query.toLowerCase();
    const limit = request.limit ?? 10;
    return [...this.store.values()]
      .filter((r) => r.organization_id === context.organization_id)
      .filter((r) => (request.scope ? r.scope === request.scope : true))
      .filter((r) => r.content.toLowerCase().includes(q) || q.length === 0)
      .slice(0, limit);
  }
}

export class NoopBusAdapter implements BusAdapter {
  readonly name = "noop-bus";

  async health(): Promise<AdapterHealth> {
    return noopHealth(this.name, "bus");
  }

  async publish(
    _topic: string,
    _payload: Record<string, unknown>,
    _context: KernelContext,
  ): Promise<void> {
    // no-op
  }
}

export class NoopDatabaseAdapter implements DatabaseAdapter {
  readonly name = "noop-database";

  async health(): Promise<AdapterHealth> {
    return noopHealth(this.name, "database");
  }
}

export class NoopObjectStorageAdapter implements ObjectStorageAdapter {
  readonly name = "noop-object-storage";

  async health(): Promise<AdapterHealth> {
    return noopHealth(this.name, "object_storage");
  }
}

export class NoopVectorAdapter implements VectorAdapter {
  readonly name = "noop-vector";

  async health(): Promise<AdapterHealth> {
    return noopHealth(this.name, "vector");
  }
}

export function createNoopAdapters(): VerseCoreAdapters {
  return {
    llm: new NoopLlmAdapter(),
    memory: new NoopMemoryAdapter(),
    bus: new NoopBusAdapter(),
    database: new NoopDatabaseAdapter(),
    objectStorage: new NoopObjectStorageAdapter(),
    vector: new NoopVectorAdapter(),
  };
}
