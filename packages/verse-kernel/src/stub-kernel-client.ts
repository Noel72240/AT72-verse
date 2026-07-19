import type {
  KernelArtifactsApi,
  KernelClient,
  KernelContext,
  KernelCostApi,
  KernelEventsApi,
  KernelFilesApi,
  KernelLlmApi,
  KernelMemoryApi,
  KernelOrchestrationApi,
  KernelPersonaApi,
  KernelRegistryApi,
  KernelSkillsApi,
  KernelToolsApi,
  MemoryRecord,
} from "@at72-verse/contracts";
import { deterministicEmbedding, deterministicTokenCount, stableHash } from "./deterministic.js";
import { KernelError } from "./errors.js";
import {
  contextSnapshot,
  type KernelCallRecord,
  type KernelInstrumentationSink,
} from "./instrumentation.js";

type MemoryEntry = MemoryRecord & { pinned: boolean; links: string[] };

/**
 * In-memory deterministic Kernel (Phase 07 Decision H1).
 * Transport is opaque — agents only see KernelClient.
 */
export class StubKernelClient implements KernelClient {
  readonly context: KernelContext;
  readonly llm: KernelLlmApi;
  readonly memory: KernelMemoryApi;
  readonly tools: KernelToolsApi;
  readonly skills: KernelSkillsApi;
  readonly persona: KernelPersonaApi;
  readonly orchestration: KernelOrchestrationApi;
  readonly events: KernelEventsApi;
  readonly artifacts: KernelArtifactsApi;
  readonly cost: KernelCostApi;
  readonly registry: KernelRegistryApi;
  readonly files: KernelFilesApi;

  private readonly calls: KernelCallRecord[] = [];
  private readonly sink: KernelInstrumentationSink | undefined;
  private readonly memoryStore = new Map<string, MemoryEntry>();
  private readonly artifactsStore = new Map<string, { name: string; data: unknown }>();
  private readonly filesStore = new Map<string, Uint8Array>();
  private readonly eventsLog: Array<{
    eventType: string;
    payload: Record<string, unknown>;
  }> = [];
  private readonly budget = { remaining_usd: 10, remaining_tokens: 100_000 };

  constructor(context: KernelContext, options?: { instrumentation?: KernelInstrumentationSink }) {
    this.context = Object.freeze({ ...context });
    this.sink = options?.instrumentation;

    this.llm = {
      complete: (request) =>
        this.instrument("llm", "complete", request, async () => {
          const joined = request.messages.map((m) => m.content).join("\n");
          const hash = stableHash({ profile: request.profile, joined });
          const content = `[stub:${request.profile}] ${hash.slice(0, 16)} :: ${joined.slice(0, 120)}`;
          const inputTokens = deterministicTokenCount(joined);
          const outputTokens = deterministicTokenCount(content);
          this.budget.remaining_tokens = Math.max(
            0,
            this.budget.remaining_tokens - inputTokens - outputTokens,
          );
          const costUsd = (inputTokens + outputTokens) * 0.000001;
          this.budget.remaining_usd = Math.max(0, this.budget.remaining_usd - costUsd);
          return {
            result: {
              content,
              llm_call_id: `stub_${hash.slice(0, 32)}`,
              usage: {
                input_tokens: inputTokens,
                output_tokens: outputTokens,
                credential_source: "platform" as const,
              },
            },
            cost_usd: costUsd,
          };
        }),
      stream: (_request) => ({
        [Symbol.asyncIterator]() {
          return {
            next: async () => {
              throw new KernelError(
                "UNAVAILABLE",
                "Kernel.llm.stream is not available (Phase 13 / AU2)",
                { details: { family: "llm", method: "stream" } },
              );
            },
          };
        },
      }),
      embed: (request) =>
        this.instrument("llm", "embed", request, async () => {
          const inputs = Array.isArray(request.input) ? request.input : [request.input];
          return {
            result: { vectors: inputs.map((t) => deterministicEmbedding(t)) },
            cost_usd: inputs.length * 0.00001,
          };
        }),
    };

    this.memory = {
      remember: (request) =>
        this.instrument("memory", "remember", request, async () => {
          const id = `mem_${stableHash({
            run: this.context.run_id,
            scope: request.scope,
            content: request.content,
            type: request.type ?? "note",
          }).slice(0, 24)}`;
          const record: MemoryEntry = {
            id,
            scope: request.scope,
            content: request.content,
            layer: "L1",
            type: "ephemeral",
            organization_id: this.context.organization_id,
            workspace_id: this.context.workspace_id,
            run_id: this.context.run_id,
            conversation_id: this.context.conversation_id ?? null,
            user_id: this.context.user_id,
            agent_id: this.context.agent_id,
            trace_id: this.context.trace_id,
            created_at: new Date().toISOString(),
            pinned: false,
            links: [],
          };
          this.memoryStore.set(id, record);
          return {
            result: {
              id,
              scope: record.scope,
              content: record.content,
              layer: record.layer,
              type: record.type,
              organization_id: record.organization_id,
              workspace_id: record.workspace_id,
              run_id: record.run_id,
              conversation_id: record.conversation_id,
              user_id: record.user_id,
              agent_id: record.agent_id,
              trace_id: record.trace_id,
              created_at: record.created_at,
            },
          };
        }),
      recall: (request) =>
        this.instrument("memory", "recall", request, async () => {
          const limit = request.limit ?? 10;
          const q = request.query.toLowerCase();
          const matches = [...this.memoryStore.values()]
            .filter((r) => (request.scope ? r.scope === request.scope : true))
            .filter((r) => r.content.toLowerCase().includes(q) || q.length === 0)
            .slice(0, limit)
            .map(
              ({
                id,
                scope,
                content,
                layer,
                type,
                organization_id,
                workspace_id,
                run_id,
                conversation_id,
                user_id,
                agent_id,
                trace_id,
                created_at,
              }) => ({
                id,
                scope,
                content,
                layer,
                type,
                organization_id,
                workspace_id,
                run_id,
                conversation_id,
                user_id,
                agent_id,
                trace_id,
                created_at,
              }),
            );
          return { result: matches };
        }),
      summarize: (scope) =>
        this.instrument("memory", "summarize", { scope }, async () => {
          const items = [...this.memoryStore.values()].filter((r) => r.scope === scope);
          const result = items.map((r) => r.content).join(" | ") || `(empty:${scope})`;
          return { result };
        }),
      forget: (id) =>
        this.instrument("memory", "forget", { id }, async () => {
          if (!this.memoryStore.delete(id)) {
            throw new KernelError("NOT_FOUND", `Memory record not found: ${id}`);
          }
          return { result: undefined };
        }),
      pin: (id) =>
        this.instrument("memory", "pin", { id }, async () => {
          const entry = this.memoryStore.get(id);
          if (!entry) {
            throw new KernelError("NOT_FOUND", `Memory record not found: ${id}`);
          }
          entry.pinned = true;
          return { result: undefined };
        }),
      link: (fromId, toId) =>
        this.instrument("memory", "link", { fromId, toId }, async () => {
          const from = this.memoryStore.get(fromId);
          const to = this.memoryStore.get(toId);
          if (!from || !to) {
            throw new KernelError("NOT_FOUND", "Cannot link missing memory records");
          }
          if (!from.links.includes(toId)) from.links.push(toId);
          return { result: undefined };
        }),
    };

    this.tools = {
      execute: (request) =>
        this.instrument("tools", "execute", request, async () => {
          const execution_id = `tex_${stableHash({
            run: this.context.run_id,
            ...request,
          }).slice(0, 24)}`;
          const output: Record<string, unknown> =
            request.tool_id === "web-search"
              ? {
                  results: [
                    {
                      title: `Stub: ${String(request.input.query ?? "query")}`,
                      url: `https://example.com/q=${encodeURIComponent(String(request.input.query ?? "query"))}`,
                      snippet: `Stub snippet for ${String(request.input.query ?? "query")}`,
                    },
                  ],
                }
              : {
                  tool_id: request.tool_id,
                  echo: request.input,
                  stub: true,
                  hash: stableHash(request).slice(0, 12),
                };
          return {
            result: {
              execution_id,
              output,
            },
          };
        }),
      listAvailable: () =>
        this.instrument("tools", "listAvailable", {}, async () => ({
          result: this.context.tools_allowlist?.length
            ? [...this.context.tools_allowlist]
            : ["stub.echo", "stub.ping"],
        })),
    };

    this.skills = {
      invoke: (request) =>
        this.instrument("skills", "invoke", request, async () => ({
          result: {
            output: {
              skill_id: request.skill_id,
              echo: request.input,
              stub: true,
            },
          },
        })),
      resolve: (skillId) =>
        this.instrument("skills", "resolve", { skillId }, async () => ({
          result: { id: skillId, version: "0.0.0-stub" },
        })),
    };

    this.persona = {
      resolve: (agentId) =>
        this.instrument("persona", "resolve", { agentId }, async () => ({
          result: {
            agent_id: agentId,
            persona_id: `persona.${agentId}.default`,
            version: "0.0.0-stub",
            spec: {
              id: `persona.${agentId}.default`,
              version: "0.0.0-stub",
              agent_id: agentId,
              personality: { traits: ["stub"] },
              tone: { formality: "tutoiement" },
              style: {},
              rules: [],
              memory: {
                read_scopes: ["run.working", "conversation", "user.private"],
                write_scopes: ["run.working", "conversation", "user.private"],
              },
              tools: [],
              skills: [],
              model_profiles: { default: "fast-cheap" as const },
              locale: "fr-FR",
              safety_profile: "standard" as const,
            },
            provenance: {
              layers: [
                {
                  layer: "agent" as const,
                  source_id: `persona.${agentId}.default`,
                  contributed_fields: ["personality"],
                },
              ],
            },
          },
        })),
    };

    this.orchestration = {
      delegate: (request) =>
        this.instrument("orchestration", "delegate", request, async () => ({
          result: {
            step_id: `step_${stableHash({
              run: this.context.run_id,
              ...request,
            }).slice(0, 16)}`,
            status: "completed" as const,
            result: { stub: true, target_agent: request.target_agent },
          },
        })),
      delegateMany: (request) =>
        this.instrument("orchestration", "delegateMany", request, async () => ({
          result: {
            results: request.targets.map((t) => ({
              step_id: `step_${stableHash({
                run: this.context.run_id,
                target: t.target_agent,
                task: t.task,
              }).slice(0, 16)}`,
              status: "completed" as const,
              result: { stub: true, target_agent: t.target_agent },
            })),
          },
        })),
      ask: (targetAgent, question) =>
        this.instrument("orchestration", "ask", { targetAgent, question }, async () => ({
          result: {
            from: targetAgent,
            answer: { text: `stub-answer:${stableHash(question).slice(0, 12)}` },
            status: "completed" as const,
            step_id: `consult_${stableHash({
              run: this.context.run_id,
              targetAgent,
              question,
            }).slice(0, 16)}`,
          },
        })),
      completeTask: (stepId, result) =>
        this.instrument("orchestration", "completeTask", { stepId, result }, async () => ({
          result: undefined,
        })),
      requestHitl: (reason) =>
        this.instrument("orchestration", "requestHitl", { reason }, async () => ({
          result: {
            approval_id: `hitl_${stableHash({
              run: this.context.run_id,
              reason,
            }).slice(0, 16)}`,
          },
        })),
    };

    this.events = {
      emit: (eventType, payload) =>
        this.instrument("events", "emit", { eventType, payload }, async () => {
          this.eventsLog.push({ eventType, payload });
          return { result: undefined };
        }),
    };

    this.artifacts = {
      write: (name, data) =>
        this.instrument("artifacts", "write", { name, data }, async () => {
          const artifact_id = `art_${stableHash({
            run: this.context.run_id,
            name,
            data,
          }).slice(0, 16)}`;
          this.artifactsStore.set(artifact_id, { name, data });
          return { result: { artifact_id } };
        }),
      read: (artifactId) =>
        this.instrument("artifacts", "read", { artifactId }, async () => {
          const row = this.artifactsStore.get(artifactId);
          if (!row) {
            throw new KernelError("NOT_FOUND", `Artifact not found: ${artifactId}`);
          }
          return { result: row.data };
        }),
      list: () =>
        this.instrument("artifacts", "list", {}, async () => ({
          result: [...this.artifactsStore.entries()].map(([artifact_id, v]) => ({
            artifact_id,
            name: v.name,
          })),
        })),
    };

    this.cost = {
      estimate: (profile, approxTokens) =>
        this.instrument("cost", "estimate", { profile, approxTokens }, async () => ({
          result: { usd: Number((approxTokens * 0.000002).toFixed(6)) },
        })),
      getBudget: () =>
        this.instrument("cost", "getBudget", {}, async () => ({
          result: { ...this.budget },
        })),
    };

    this.registry = {
      getAgent: (id) =>
        this.instrument("registry", "getAgent", { id }, async () => ({
          result: { id, kind: "stub", version: "0.0.0-stub" },
        })),
      getSkill: (id) =>
        this.instrument("registry", "getSkill", { id }, async () => ({
          result: { id, version: "0.0.0-stub" },
        })),
      getTool: (id) =>
        this.instrument("registry", "getTool", { id }, async () => ({
          result: { id, version: "0.0.0-stub" },
        })),
    };

    this.files = {
      upload: (path, bytes) =>
        this.instrument("files", "upload", { path, byteLength: bytes.byteLength }, async () => {
          const file_id = `file_${stableHash({
            run: this.context.run_id,
            path,
            len: bytes.byteLength,
            head: Buffer.from(bytes.slice(0, 32)).toString("hex"),
          }).slice(0, 16)}`;
          this.filesStore.set(file_id, bytes);
          return { result: { file_id } };
        }),
      download: (fileId) =>
        this.instrument("files", "download", { fileId }, async () => {
          const bytes = this.filesStore.get(fileId);
          if (!bytes) {
            throw new KernelError("NOT_FOUND", `File not found: ${fileId}`);
          }
          return { result: bytes };
        }),
    };
  }

  /** Call history for tests / debugging (not on KernelClient public surface). */
  getCallHistory(): readonly KernelCallRecord[] {
    return this.calls;
  }

  getEmittedEvents(): ReadonlyArray<{
    eventType: string;
    payload: Record<string, unknown>;
  }> {
    return this.eventsLog;
  }

  private recordCall(record: KernelCallRecord): void {
    this.calls.push(record);
    this.sink?.onCall(record);
  }

  private async instrument<T>(
    family: string,
    method: string,
    input: unknown,
    fn: () => Promise<{ result: T; cost_usd?: number | null }>,
  ): Promise<T> {
    const started = Date.now();
    const startedAt = new Date(started).toISOString();
    try {
      const { result, cost_usd = null } = await fn();
      const record: KernelCallRecord = {
        family,
        method,
        input,
        output: result,
        success: true,
        duration_ms: Date.now() - started,
        cost_usd,
        started_at: startedAt,
        context: contextSnapshot(this.context),
      };
      this.recordCall(record);
      return result;
    } catch (err) {
      const kernelErr =
        err instanceof KernelError
          ? err
          : new KernelError("INTERNAL", err instanceof Error ? err.message : String(err), {
              cause: err,
            });
      const record: KernelCallRecord = {
        family,
        method,
        input,
        error: { code: kernelErr.code, message: kernelErr.message },
        success: false,
        duration_ms: Date.now() - started,
        cost_usd: null,
        started_at: startedAt,
        context: contextSnapshot(this.context),
      };
      this.recordCall(record);
      throw kernelErr;
    }
  }
}
