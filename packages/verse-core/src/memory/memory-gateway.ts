/**
 * Memory Gateway (Phase 18 / DL10 · Phase 25 L4 / ADR-007).
 * Authz via Persona Engine; persistence via MemoryStorePort;
 * semantic recall via VectorIndexPort (optional, kill-switchable).
 * Agents never touch the vector engine — only Kernel.memory.*.
 */
import { randomUUID } from "node:crypto";
import type {
  KernelContext,
  MemoryLayer,
  MemoryRecallExplanation,
  MemoryRecallRequest,
  MemoryRecord,
  MemoryRecordType,
  MemoryRememberRequest,
} from "@at72-verse/contracts";
import { KernelError } from "@at72-verse/verse-kernel";
import type { PersonaEngine } from "../persona/persona-engine.js";
import type { ConversationSummarizerPort } from "./conversation-summarizer.js";
import { deterministicEmbedding } from "./deterministic-embedding.js";
import type { MemoryStorePort } from "./memory-store-port.js";
import {
  MEMORY_EMBEDDING_DIMS,
  MEMORY_EMBEDDING_MODEL_STUB,
  type VectorIndexPort,
} from "./vector-index-port.js";

const SUPPORTED_RECORD_TYPES = new Set<MemoryRecordType>([
  "ephemeral",
  "conversational",
  "factual",
  "procedural",
  "artifact_ref",
  "credential_ref",
]);

const L4_SCOPES = new Set(["org.brand", "org.content", "organization.brand", "organization.content"]);

export type MemoryScopeBinding = {
  layer: MemoryLayer;
  run_id: string | null;
  conversation_id: string | null;
  /** When true, store/query bind to context.user_id. */
  bind_user: boolean;
};

export function resolveMemoryScopeBinding(
  scope: string,
  context: KernelContext,
): MemoryScopeBinding {
  if (scope === "run.working") {
    return {
      layer: "L1",
      run_id: context.run_id,
      conversation_id: null,
      bind_user: false,
    };
  }
  if (scope === "conversation" || scope.startsWith("conversation.")) {
    const conversationId = context.conversation_id ?? null;
    if (!conversationId) {
      throw new KernelError(
        "INVALID_INPUT",
        "Scope conversation.* requires conversation_id on Kernel context",
        { details: { scope } },
      );
    }
    return {
      layer: "L2",
      run_id: context.run_id,
      conversation_id: conversationId,
      bind_user: false,
    };
  }
  if (scope === "user" || scope.startsWith("user.")) {
    if (!context.user_id) {
      throw new KernelError(
        "INVALID_INPUT",
        "Scope user.* requires user_id on Kernel context",
        { details: { scope } },
      );
    }
    return {
      layer: "L2",
      run_id: context.run_id,
      conversation_id: context.conversation_id ?? null,
      bind_user: true,
    };
  }
  if (L4_SCOPES.has(scope) || scope.startsWith("org.") || scope.startsWith("organization.")) {
    return {
      layer: "L4",
      run_id: null,
      conversation_id: null,
      bind_user: false,
    };
  }
  throw new KernelError("UNAVAILABLE", `Memory scope not supported: ${scope}`, {
    details: { scope },
  });
}

function normalizeType(raw: string | undefined, layer: MemoryLayer): MemoryRecordType {
  if (raw && SUPPORTED_RECORD_TYPES.has(raw as MemoryRecordType)) {
    return raw as MemoryRecordType;
  }
  if (layer === "L1") return "ephemeral";
  if (layer === "L4") return "factual";
  return "conversational";
}

function assertScopeAllowed(scopes: string[], scope: string, op: "read" | "write"): void {
  if (!scopes.includes(scope)) {
    throw new KernelError(
      "FORBIDDEN",
      `Persona does not allow memory ${op} on scope "${scope}"`,
      { details: { scope, allowed: scopes, op } },
    );
  }
}

function isSemanticEnabled(envValue?: string | null): boolean {
  if (envValue === undefined || envValue === null) {
    return process.env.VERSE_SEMANTIC_MEMORY !== "0" && process.env.VERSE_SEMANTIC_MEMORY !== "false";
  }
  return envValue !== "0" && envValue !== "false";
}

export type EmbedFn = (texts: string[], context: KernelContext) => Promise<number[][]>;

export type MemoryGatewayOptions = {
  store: MemoryStorePort;
  personaEngine: PersonaEngine;
  summarizer: ConversationSummarizerPort;
  vectorIndex?: VectorIndexPort;
  /** When false, L4 recall falls back to substring (PO kill-switch). */
  semanticEnabled?: boolean;
  /** Override embed — default deterministic stub (Gateway still goes through Kernel for agent path). */
  embed?: EmbedFn;
};

export class MemoryGateway {
  private store: MemoryStorePort;
  private personaEngine: PersonaEngine;
  private summarizer: ConversationSummarizerPort;
  private vectorIndex: VectorIndexPort | undefined;
  private semanticEnabled: boolean;
  private embedFn: EmbedFn;

  constructor(options: MemoryGatewayOptions) {
    this.store = options.store;
    this.personaEngine = options.personaEngine;
    this.summarizer = options.summarizer;
    this.vectorIndex = options.vectorIndex;
    this.semanticEnabled =
      options.semanticEnabled !== undefined
        ? options.semanticEnabled
        : isSemanticEnabled();
    this.embedFn =
      options.embed ??
      (async (texts) => texts.map((t) => deterministicEmbedding(t)));
  }

  setStore(store: MemoryStorePort): void {
    this.store = store;
  }

  setVectorIndex(index: VectorIndexPort | undefined): void {
    this.vectorIndex = index;
  }

  setSemanticEnabled(enabled: boolean): void {
    this.semanticEnabled = enabled;
  }

  isSemanticEnabled(): boolean {
    return this.semanticEnabled && Boolean(this.vectorIndex);
  }

  setEmbedFn(fn: EmbedFn): void {
    this.embedFn = fn;
  }

  setPersonaEngine(engine: PersonaEngine): void {
    this.personaEngine = engine;
  }

  setSummarizer(summarizer: ConversationSummarizerPort): void {
    this.summarizer = summarizer;
  }

  getSummarizer(): ConversationSummarizerPort {
    return this.summarizer;
  }

  async remember(request: MemoryRememberRequest, context: KernelContext): Promise<MemoryRecord> {
    const resolved = await this.personaEngine.resolve(
      context.agent_id,
      context.organization_id,
      context.workspace_id,
    );
    assertScopeAllowed(resolved.spec.memory.write_scopes, request.scope, "write");

    const binding = resolveMemoryScopeBinding(request.scope, context);
    const type = normalizeType(request.type, binding.layer);
    const now = new Date().toISOString();
    const record: MemoryRecord = {
      id: randomUUID(),
      scope: request.scope,
      content: request.content,
      layer: binding.layer,
      type,
      organization_id: context.organization_id,
      workspace_id: context.workspace_id,
      run_id: binding.run_id,
      conversation_id: binding.conversation_id ?? context.conversation_id ?? null,
      user_id: binding.bind_user ? context.user_id : null,
      agent_id: context.agent_id,
      trace_id: context.trace_id ?? null,
      created_at: now,
      pinned: false,
      deleted_at: null,
    };
    const saved = await this.store.insert(record);
    if (binding.layer === "L4") {
      await this.indexRecord(saved, context);
    }
    return saved;
  }

  /**
   * Admin / API path for brand facts (no agent persona) — still indexes via VectorIndexPort.
   */
  async adminRemember(input: {
    organization_id: string;
    workspace_id: string;
    scope: string;
    content: string;
    type?: MemoryRecordType;
    pinned?: boolean;
    agent_id?: string;
  }): Promise<MemoryRecord> {
    if (!L4_SCOPES.has(input.scope) && !input.scope.startsWith("org.")) {
      throw new KernelError("INVALID_INPUT", `Admin memory write limited to org.* scopes`, {
        details: { scope: input.scope },
      });
    }
    const now = new Date().toISOString();
    const record: MemoryRecord = {
      id: randomUUID(),
      scope: input.scope,
      content: input.content,
      layer: "L4",
      type: input.type ?? "factual",
      organization_id: input.organization_id,
      workspace_id: input.workspace_id,
      run_id: null,
      conversation_id: null,
      user_id: null,
      agent_id: input.agent_id ?? "admin",
      trace_id: null,
      created_at: now,
      pinned: input.pinned ?? false,
      deleted_at: null,
    };
    const saved = await this.store.insert(record);
    await this.indexRecord(saved, {
      run_id: "00000000-0000-4000-8000-000000000001",
      agent_id: "admin",
      organization_id: input.organization_id,
      workspace_id: input.workspace_id,
      trace_id: "00000000-0000-4000-8000-000000000002",
    } as KernelContext);
    return saved;
  }

  async recall(request: MemoryRecallRequest, context: KernelContext): Promise<MemoryRecord[]> {
    const scope = request.scope;
    if (!scope) {
      throw new KernelError("INVALID_INPUT", "Memory recall requires an explicit scope", {
        details: { method: "recall" },
      });
    }

    const resolved = await this.personaEngine.resolve(
      context.agent_id,
      context.organization_id,
      context.workspace_id,
    );
    assertScopeAllowed(resolved.spec.memory.read_scopes, scope, "read");

    const binding = resolveMemoryScopeBinding(scope, context);
    const limit = request.limit ?? 10;

    if (binding.layer === "L4" && request.query.trim() && this.isSemanticEnabled()) {
      return this.semanticRecall(request.query, scope, limit, context);
    }

    const strategy: MemoryRecallExplanation["strategy"] =
      binding.layer === "L4" && request.query.trim() && !this.isSemanticEnabled()
        ? "semantic_disabled_fallback"
        : "substring";

    const rows = await this.store.query({
      organization_id: context.organization_id,
      workspace_id: context.workspace_id,
      scope,
      layer: binding.layer,
      run_id: binding.layer === "L1" ? binding.run_id : undefined,
      conversation_id: binding.conversation_id ?? undefined,
      user_id: binding.bind_user ? context.user_id : undefined,
      query: request.query,
      limit,
    });

    return rows.map((r) => ({
      ...r,
      explanation: {
        strategy,
        score: 1,
        distance: 0,
        source: "memory_store" as const,
      },
    }));
  }

  async summarize(scope: string, context: KernelContext): Promise<string> {
    const records = await this.recall({ scope, query: "", limit: 50 }, context);
    return this.summarizer.summarize({ scope, records });
  }

  async pin(id: string, context: KernelContext): Promise<void> {
    const resolved = await this.personaEngine.resolve(
      context.agent_id,
      context.organization_id,
      context.workspace_id,
    );
    const policy = resolved.spec.memory.pin_policy ?? "none";
    const record = await this.store.getById(id, context.organization_id);
    if (!record || record.deleted_at) {
      throw new KernelError("NOT_FOUND", `Memory record not found: ${id}`);
    }
    if (policy === "none") {
      throw new KernelError("FORBIDDEN", "Persona pin_policy does not allow pin", {
        details: { pin_policy: policy },
      });
    }
    if (policy === "pin_brand_only" && record.scope !== "org.brand" && record.scope !== "organization.brand") {
      throw new KernelError("FORBIDDEN", "pin_brand_only allows only org.brand records", {
        details: { scope: record.scope },
      });
    }
    assertScopeAllowed(resolved.spec.memory.read_scopes, record.scope, "read");
    await this.store.setPinned(id, context.organization_id, true);
  }

  async forget(id: string, context: KernelContext): Promise<void> {
    const resolved = await this.personaEngine.resolve(
      context.agent_id,
      context.organization_id,
      context.workspace_id,
    );
    const record = await this.store.getById(id, context.organization_id);
    if (!record) {
      throw new KernelError("NOT_FOUND", `Memory record not found: ${id}`);
    }
    assertScopeAllowed(resolved.spec.memory.write_scopes, record.scope, "write");
    await this.store.softDelete(id, context.organization_id);
    if (this.vectorIndex) {
      await this.vectorIndex.deleteByMemoryId(id);
    }
  }

  async adminForget(id: string, organizationId: string): Promise<void> {
    await this.store.softDelete(id, organizationId);
    if (this.vectorIndex) {
      await this.vectorIndex.deleteByMemoryId(id);
    }
  }

  async adminPin(id: string, organizationId: string): Promise<MemoryRecord> {
    return this.store.setPinned(id, organizationId, true);
  }

  private async semanticRecall(
    query: string,
    scope: string,
    limit: number,
    context: KernelContext,
  ): Promise<MemoryRecord[]> {
    const index = this.vectorIndex!;
    const [queryVec] = await this.embedFn([query], context);
    const hits = await index.search({
      organization_id: context.organization_id,
      scope,
      query_embedding: queryVec!,
      limit,
    });

    const out: MemoryRecord[] = [];
    for (const hit of hits) {
      const row = await this.store.getById(hit.memory_id, context.organization_id);
      if (!row || row.deleted_at) continue;
      if (row.scope !== scope) continue;
      out.push({
        ...row,
        explanation: {
          strategy: "semantic",
          score: hit.score,
          distance: hit.distance,
          source: "vector_index",
        },
      });
    }
    // Pinned first, then score desc, then id
    out.sort((a, b) => {
      const pin = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
      if (pin !== 0) return pin;
      const sa = a.explanation?.score ?? 0;
      const sb = b.explanation?.score ?? 0;
      if (sa !== sb) return sb - sa;
      return a.id.localeCompare(b.id);
    });
    return out.slice(0, limit);
  }

  private async indexRecord(record: MemoryRecord, context: KernelContext): Promise<void> {
    if (!this.vectorIndex || !this.semanticEnabled) return;
    const [vec] = await this.embedFn([record.content], context);
    await this.vectorIndex.upsert({
      memory_id: record.id,
      organization_id: record.organization_id,
      scope: record.scope,
      embedding: vec!,
      model: MEMORY_EMBEDDING_MODEL_STUB,
      dims: MEMORY_EMBEDDING_DIMS,
    });
  }
}
