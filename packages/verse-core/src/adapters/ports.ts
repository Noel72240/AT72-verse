/**
 * Definitive adapter ports (Phase 08 Decision K).
 * No-op implementations today; real providers replace these without changing Core façade.
 */
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

export type AdapterStatus = "ok" | "noop" | "degraded" | "down";

export type AdapterHealth = {
  name: string;
  kind: string;
  status: AdapterStatus;
  detail?: string;
};

export interface LlmAdapter {
  readonly name: string;
  health(): Promise<AdapterHealth>;
  complete(request: LlmCompleteRequest, context: KernelContext): Promise<LlmCompletion>;
  embed(request: LlmEmbedRequest, context: KernelContext): Promise<LlmEmbedding>;
}

export interface MemoryAdapter {
  readonly name: string;
  health(): Promise<AdapterHealth>;
  remember(request: MemoryRememberRequest, context: KernelContext): Promise<MemoryRecord>;
  recall(request: MemoryRecallRequest, context: KernelContext): Promise<MemoryRecord[]>;
}

export interface BusAdapter {
  readonly name: string;
  health(): Promise<AdapterHealth>;
  publish(topic: string, payload: Record<string, unknown>, context: KernelContext): Promise<void>;
}

export interface DatabaseAdapter {
  readonly name: string;
  health(): Promise<AdapterHealth>;
}

export interface ObjectStorageAdapter {
  readonly name: string;
  health(): Promise<AdapterHealth>;
}

export interface VectorAdapter {
  readonly name: string;
  health(): Promise<AdapterHealth>;
}

export type VerseCoreAdapters = {
  llm: LlmAdapter;
  memory: MemoryAdapter;
  bus: BusAdapter;
  database: DatabaseAdapter;
  objectStorage: ObjectStorageAdapter;
  vector: VectorAdapter;
};
