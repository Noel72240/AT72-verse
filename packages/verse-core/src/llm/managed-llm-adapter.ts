/**
 * Managed LlmAdapter (Phase 13): route → credentials → provider → usage bus event.
 */
import { randomUUID } from "node:crypto";
import type { Bus } from "@at72-verse/bus";
import { llmTopic } from "@at72-verse/bus";
import type {
  KernelContext,
  LlmCompleteRequest,
  LlmCompletion,
  LlmEmbedRequest,
  LlmEmbedding,
  LlmUsageRecordedPayload,
} from "@at72-verse/contracts";
import { KernelError } from "@at72-verse/verse-kernel";
import type { AdapterHealth, LlmAdapter } from "../adapters/ports.js";
import { resolvePlatformCredentials, type CredentialResolverOptions } from "./credentials.js";
import { resolveModelRoute } from "./model-router.js";
import { estimateTokensUsd } from "../cost/rate-card.js";
import type { LlmProviderAdapter } from "./provider-port.js";
import { OpenAiProviderAdapter } from "./openai-provider.js";

export type ManagedLlmAdapterOptions = {
  bus: Bus;
  provider?: LlmProviderAdapter;
  credentials?: CredentialResolverOptions;
};

export class ManagedLlmAdapter implements LlmAdapter {
  readonly name: string;
  private readonly bus: Bus;
  private readonly provider: LlmProviderAdapter;
  private readonly credentials: CredentialResolverOptions;

  constructor(options: ManagedLlmAdapterOptions) {
    this.bus = options.bus;
    this.provider = options.provider ?? new OpenAiProviderAdapter();
    this.credentials = options.credentials ?? {};
    this.name = `managed-llm:${this.provider.id}`;
  }

  async health(): Promise<AdapterHealth> {
    try {
      resolvePlatformCredentials(this.credentials);
      return {
        name: this.name,
        kind: "llm",
        status: "ok",
        detail: `provider=${this.provider.id}`,
      };
    } catch {
      return {
        name: this.name,
        kind: "llm",
        status: "degraded",
        detail: "platform credentials missing",
      };
    }
  }

  async complete(request: LlmCompleteRequest, context: KernelContext): Promise<LlmCompletion> {
    const route = resolveModelRoute(request.profile);
    if (route.provider !== this.provider.id) {
      throw new KernelError(
        "UNAVAILABLE",
        `No provider adapter registered for "${route.provider}"`,
        { details: { provider: route.provider, profile: route.profile } },
      );
    }

    const creds = resolvePlatformCredentials(this.credentials);
    const llmCallId = randomUUID();

    const result = await this.provider.complete({
      model: route.model,
      messages: request.messages,
      max_tokens: request.max_tokens,
      llm_call_id: llmCallId,
      context,
      apiKey: creds.apiKey,
    });

    const priced = estimateTokensUsd({
      model: route.model,
      input_tokens: result.input_tokens,
      output_tokens: result.output_tokens,
    });

    const usagePayload: LlmUsageRecordedPayload = {
      llm_call_id: llmCallId,
      run_id: context.run_id,
      trace_id: context.trace_id,
      organization_id: context.organization_id,
      workspace_id: context.workspace_id,
      agent_id: context.agent_id,
      profile: route.profile,
      provider: route.provider,
      model: route.model,
      input_tokens: result.input_tokens,
      output_tokens: result.output_tokens,
      credential_source: creds.credential_source,
      estimated_usd: priced.estimated_usd,
      pricing_version: context.budget_snapshot?.pricing_version ?? priced.pricing_version,
    };

    await this.publishUsage(usagePayload, context);

    return {
      content: result.content,
      llm_call_id: llmCallId,
      usage: {
        input_tokens: result.input_tokens,
        output_tokens: result.output_tokens,
        credential_source: creds.credential_source,
      },
    };
  }

  async embed(request: LlmEmbedRequest, context: KernelContext): Promise<LlmEmbedding> {
    const inputs = Array.isArray(request.input) ? request.input : [request.input];
    const llmCallId = randomUUID();
    // MVP: deterministic stub embeddings (provider-ready later). Same dims as pgvector column.
    const { deterministicEmbedding } = await import("../memory/deterministic-embedding.js");
    const { MEMORY_EMBEDDING_DIMS } = await import("../memory/vector-index-port.js");
    const vectors = inputs.map((t) => deterministicEmbedding(t, MEMORY_EMBEDDING_DIMS));

    const approxTokens = inputs.reduce((n, t) => n + Math.max(1, Math.ceil(t.length / 4)), 0);
    const priced = estimateTokensUsd({
      model: "text-embedding-3-small",
      input_tokens: approxTokens,
      output_tokens: 0,
    });

    const usagePayload: LlmUsageRecordedPayload = {
      llm_call_id: llmCallId,
      run_id: context.run_id,
      trace_id: context.trace_id,
      organization_id: context.organization_id,
      workspace_id: context.workspace_id,
      agent_id: context.agent_id,
      profile: "fast-cheap",
      provider: this.provider.id,
      model: "text-embedding-3-small",
      input_tokens: approxTokens,
      output_tokens: 0,
      credential_source: "platform",
      estimated_usd: priced.estimated_usd,
      pricing_version: context.budget_snapshot?.pricing_version ?? priced.pricing_version,
    };
    await this.publishUsage(usagePayload, context);

    return { vectors };
  }

  private async publishUsage(
    payload: LlmUsageRecordedPayload,
    context: KernelContext,
  ): Promise<void> {
    await this.bus.publish(
      {
        event_id: randomUUID(),
        correlation_id: context.trace_id,
        causation_id: payload.llm_call_id,
        tenant_id: context.organization_id,
        workspace_id: context.workspace_id,
        run_id: context.run_id,
        timestamp: new Date().toISOString(),
        version: "1",
        event_type: "llm.usage.recorded",
        payload: { ...payload },
      },
      { topic: llmTopic("usage") },
    );
  }
}
