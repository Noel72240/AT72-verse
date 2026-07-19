export type { IsoDateTime, SemVer, UlidOrUuid } from "./common/primitives.js";
export {
  MODEL_PROFILE_IDS,
  ROUTED_MODEL_PROFILE_IDS,
  isModelProfileId,
  isRoutedModelProfileId,
  type ModelProfileId,
  type RoutedModelProfileId,
} from "./common/model-profiles.js";
export type { LlmCredentialSource, LlmUsageRecordedPayload } from "./llm/llm-usage.js";

export type {
  BusMessage,
  BusMessageExtensions,
  BusMessageKind,
  BusMessageWithExtensions,
  MessageEnvelope,
} from "./bus/bus-message.js";

export type {
  Bus,
  BusBroadcastOptions,
  BusHandler,
  BusPublishOptions,
  BusRequestOptions,
  BusSubscribeOptions,
  BusTopic,
  BusUnsubscribe,
} from "./bus/bus-api.js";

export type {
  AgentConstraints,
  AgentKind,
  AgentManifest,
  AgentPackageRef,
  AgentRoutingHints,
  AgentUiMeta,
} from "./agents/agent-manifest.js";

export type {
  AgentPlan,
  AgentPlanStepSpec,
  AgentTaskCompletedPayload,
  AgentTaskConsultedPayload,
  AgentTaskDelegatedPayload,
  AgentTaskPayload,
} from "./agents/agent-task.js";

export type {
  PersonaMemoryPolicy,
  PersonaModelProfiles,
  PersonaPersonality,
  PersonaRule,
  PersonaRuleSeverity,
  PersonaSafetyProfile,
  PersonaSpec,
  PersonaStyle,
  PersonaTone,
} from "./personas/persona-spec.js";

export type {
  PersonaMergeLayer,
  PersonaProvenanceEntry,
  PersonaSpecPatch,
  ResolvedPersona,
} from "./personas/resolved-persona.js";

export type { JsonSchema, SkillSpec } from "./skills/skill-spec.js";
export type { SkillExecuteContext, SkillModule, SkillPlugin } from "./skills/skill-module.js";

export type {
  ToolAuth,
  ToolAuthType,
  ToolPackageRef,
  ToolRateLimit,
  ToolRetryPolicy,
  ToolSpec,
} from "./tools/tool-spec.js";

export type {
  ToolExecuteContext,
  ToolModule,
  ToolPlugin,
} from "./tools/tool-module.js";

export type {
  AuthzDecision,
  AuthzDenialReason,
  CapabilityGrantSnapshot,
  CapabilityKind,
  PermissionGrant,
} from "./permissions/permission-grant.js";
export { FIRST_PARTY_CAPABILITY_DEFAULTS } from "./permissions/permission-grant.js";

export type {
  BudgetSnapshot,
  RunCostSummary,
} from "./cost/budget-snapshot.js";
export {
  PLATFORM_DEFAULT_RUN_BUDGET,
  PLATFORM_RATE_CARD_VERSION,
} from "./cost/budget-snapshot.js";

export type {
  PackageContractsRequirement,
  PackageKind,
  PackageManifest,
  PackagePricing,
  PackagePricingModel,
  PackageResources,
  PackageSignature,
} from "./packages/package-manifest.js";

export type {
  FirstPartyPackageSeed,
  PackageCatalogEntry,
  PackageInstallDenialReason,
  PackagesSnapshot,
  TenantPackageRecord,
  TenantPackageStatus,
} from "./packages/package-registry.js";
export { capabilityKindFromPackageKind } from "./packages/package-registry.js";
export { FIRST_PARTY_PACKAGE_SEEDS } from "./packages/first-party-packages.js";

export type {
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
  LlmCompleteRequest,
  LlmCompletion,
  LlmEmbedRequest,
  LlmEmbedding,
  MemoryLayer,
  MemoryRecallExplanation,
  MemoryRecallRequest,
  MemoryRecord,
  MemoryRecordType,
  MemoryRememberRequest,
  OrchestrationAskResult,
  OrchestrationDelegateManyRequest,
  OrchestrationDelegateManyResult,
  OrchestrationDelegateManyTarget,
  OrchestrationDelegateRequest,
  OrchestrationDelegateResult,
  SkillInvokeRequest,
  SkillInvokeResult,
  ToolExecuteRequest,
  ToolExecuteResult,
} from "./kernel/kernel-api.js";

export type {
  Conversation,
  Message,
  MessageRole,
  Run,
  RunStatus,
  RunStep,
  RunStepStatus,
} from "./runs/run.js";
export { RUN_STATUS_TRANSITIONS, canTransitionRunStatus } from "./runs/run.js";

export type {
  WorkflowDefinition,
  WorkflowRun,
  WorkflowRunStatus,
  WorkflowStepKind,
  WorkflowStepSpec,
  WorkflowTrigger,
} from "./workflows/workflow.js";
export {
  WORKFLOW_RUN_STATUS_TRANSITIONS,
  canTransitionWorkflowRunStatus,
} from "./workflows/workflow.js";

export {
  CONTRACT_EXAMPLE_FILES,
  CONTRACT_SCHEMA_FILES,
  loadJson,
  validateAgainstSchema,
  validateAllExamples,
  validateExample,
  type ContractSchemaId,
} from "./validation/validate-examples.js";
export {
  validateDataAgainstJsonSchema,
  type JsonSchemaValidationResult,
} from "./validation/validate-json-schema.js";

/** Contracts package semver — freeze v0 (+ Workflows Phase 26). */
export const CONTRACTS_VERSION = "0.1.16" as const;
