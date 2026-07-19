/**
 * @at72-verse/verse-core — public façade only (ADR-001, Phase 08).
 *
 * Hosts (`apps/api`, `apps/agent-runtime`) must import from this package root exclusively.
 * Do not import internal modules from outside this package.
 */
export { createVerseCore, type CreateVerseCoreOptions } from "./create-verse-core.js";
export { VerseCore, VERSE_CORE_VERSION } from "./facade/verse-core.js";
export type { VerseCoreHealthReport, VerseCoreStatus } from "./facade/health-types.js";
export type {
  AdapterHealth,
  AdapterStatus,
  BusAdapter,
  DatabaseAdapter,
  LlmAdapter,
  MemoryAdapter,
  ObjectStorageAdapter,
  VectorAdapter,
  VerseCoreAdapters,
} from "./adapters/ports.js";
export {
  CORE_MODULE_MANIFEST,
  type CoreModuleId,
  type CoreModuleManifestEntry,
} from "./modules/manifest.js";
export { createBusPortAdapter } from "./adapters/bus-port.js";
export { createNoopAdapters } from "./adapters/noop.js";
export { ManagedLlmAdapter, type ManagedLlmAdapterOptions } from "./llm/managed-llm-adapter.js";
export { OpenAiProviderAdapter } from "./llm/openai-provider.js";
export type {
  LlmProviderAdapter,
  ProviderCompleteInput,
  ProviderCompleteResult,
} from "./llm/provider-port.js";
export { resolveModelRoute, type ModelRoute } from "./llm/model-router.js";
export {
  hasPlatformLlmCredentials,
  resolvePlatformCredentials,
  type CredentialResolverOptions,
  type ResolvedCredentials,
} from "./llm/credentials.js";
export { mapProviderError } from "./llm/map-provider-error.js";
export type { SkillHostPort } from "./skills/skill-host-port.js";
export type {
  OrchestrationHostPort,
  OrchestrationDelegateHostRequest,
} from "./orchestration/orchestration-host-port.js";
export {
  PersonaEngine,
  mergePersonaLayers,
  resolveAgentPersonaId,
  type PersonaOverridePort,
} from "./persona/persona-engine.js";
export {
  createStampedPersonaOverridePort,
  getPersonaOverrideStamp,
  runWithPersonaOverrides,
  type PersonaOverrideStamp,
} from "./persona/override-context.js";
export { FIRST_PARTY_PERSONAS, SYSTEM_PERSONA_BASE } from "./persona/seeds.js";
export { MemoryGateway, resolveMemoryScopeBinding } from "./memory/memory-gateway.js";
export type { MemoryStorePort, MemoryStoreQuery } from "./memory/memory-store-port.js";
export type {
  VectorIndexPort,
  VectorSearchHit,
  VectorUpsertInput,
} from "./memory/vector-index-port.js";
export {
  MEMORY_EMBEDDING_DIMS,
  MEMORY_EMBEDDING_MODEL_STUB,
  cosineDistance,
  distanceToScore,
  roundScore,
} from "./memory/vector-index-port.js";
export { InMemoryMemoryStore } from "./memory/in-memory-store.js";
export { InMemoryVectorIndex } from "./memory/in-memory-vector-index.js";
export { deterministicEmbedding } from "./memory/deterministic-embedding.js";
export {
  DeterministicConversationSummarizer,
  type ConversationSummarizerPort,
} from "./memory/conversation-summarizer.js";
export { MemoryGatewayAdapter } from "./memory/memory-gateway-adapter.js";
export type { ToolHostPort } from "./tools/tool-host-port.js";
export { ToolRuntime } from "./tools/tool-runtime.js";
export type {
  ToolExecutionAuditPort,
  ToolExecutionAuditRecord,
  ToolExecutionAuditStatus,
} from "./tools/tool-audit-port.js";
export { InMemoryToolExecutionAudit } from "./tools/tool-audit-port.js";
export {
  WorkflowEngine,
  CONTENT_CAMPAIGN_DEFINITION,
  getFirstPartyWorkflowDefinitions,
  getWorkflowDefinitionById,
  type WorkflowEngineState,
  type WorkflowStepHandler,
  type WorkflowEngineOptions,
} from "./workflows/workflow-engine.js";
export {
  PermissionEngine,
  buildCapabilityGrantSnapshot,
} from "./permissions/permission-engine.js";
export type { CapabilityGrantPort, CapabilityGrantUpsert } from "./permissions/capability-grant-port.js";
export {
  CostEngine,
  buildBudgetSnapshot,
} from "./cost/cost-engine.js";
export {
  estimateTokensUsd,
  estimateProfileApproxUsd,
  getRateCardVersion,
  ratesForModel,
} from "./cost/rate-card.js";
export {
  assertCapabilityInstalled,
  buildPackagesSnapshotFromSeeds,
  findCatalogEntryByCapability,
  findCatalogEntryByPackageId,
  isCapabilityInstalled,
  listCatalogEntries,
} from "./registry/package-install-gate.js";

export const packageName = "@at72-verse/verse-core" as const;
