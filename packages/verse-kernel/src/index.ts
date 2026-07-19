/**
 * @at72-verse/verse-kernel — Kernel client library (ADR-002, Phase 07).
 *
 * Types come exclusively from `@at72-verse/contracts` (Decision G1).
 * Transport is opaque: agents never configure how Core is reached.
 */
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
  MemoryRecallRequest,
  MemoryRecord,
  MemoryRememberRequest,
  OrchestrationDelegateRequest,
  SkillInvokeRequest,
  SkillInvokeResult,
  ToolExecuteRequest,
  ToolExecuteResult,
} from "@at72-verse/contracts";

export { KernelError, type KernelErrorCode } from "./errors.js";
export type { KernelCallRecord, KernelInstrumentationSink } from "./instrumentation.js";
export {
  createKernelClient,
  type CreateKernelClientOptions,
  type CreateKernelContextInput,
  type KernelBackend,
} from "./create-kernel-client.js";
export { StubKernelClient } from "./stub-kernel-client.js";
export { runFakeAgentCycle, runFakeAgentDemo, type FakeAgentResult } from "./fake-agent.js";

export const packageName = "@at72-verse/verse-kernel" as const;
