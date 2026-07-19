import type { Bus } from "@at72-verse/bus";
import { createBusPortAdapter } from "./adapters/bus-port.js";
import { createNoopAdapters } from "./adapters/noop.js";
import type { VerseCoreAdapters } from "./adapters/ports.js";
import { VerseCore, type VerseCoreOptions } from "./facade/verse-core.js";
import { hasPlatformLlmCredentials } from "./llm/credentials.js";
import { ManagedLlmAdapter } from "./llm/managed-llm-adapter.js";
import type { OrchestrationHostPort } from "./orchestration/orchestration-host-port.js";
import type { PersonaOverridePort } from "./persona/persona-engine.js";
import type { SkillHostPort } from "./skills/skill-host-port.js";
import type { ConversationSummarizerPort } from "./memory/conversation-summarizer.js";
import type { MemoryStorePort } from "./memory/memory-store-port.js";
import type { VectorIndexPort } from "./memory/vector-index-port.js";
import type { ToolHostPort } from "./tools/tool-host-port.js";
import type { ToolExecutionAuditPort } from "./tools/tool-audit-port.js";
import type { SecretsVaultPort } from "./vault/secrets-vault-port.js";
import type { ConnectorStorePort } from "./connectors/connector-store-port.js";
import type { OAuthConnector } from "./connectors/oauth-connector.js";

export type CreateVerseCoreOptions = {
  adapters?: VerseCoreAdapters;
  bus?: Bus;
  llmMode?: "auto" | "managed" | "noop";
  kernelBackend?: "stub" | "core";
  version?: string;
  skillHost?: SkillHostPort;
  orchestrationHost?: OrchestrationHostPort;
  toolHost?: ToolHostPort;
  personaOverrides?: PersonaOverridePort;
  memoryStore?: MemoryStorePort;
  memorySummarizer?: ConversationSummarizerPort;
  vectorIndex?: VectorIndexPort;
  semanticMemoryEnabled?: boolean;
  toolAudit?: ToolExecutionAuditPort;
  secretsVault?: SecretsVaultPort;
  connectorStore?: ConnectorStorePort;
  oauthConnector?: OAuthConnector;
};

/**
 * Factory — public entry point for hosts (`apps/api`, `apps/agent-runtime`).
 */
export function createVerseCore(options: CreateVerseCoreOptions = {}): VerseCore {
  let adapters = options.adapters ?? createNoopAdapters();
  const llmMode = options.llmMode ?? "auto";

  if (options.bus) {
    adapters = {
      ...adapters,
      bus: createBusPortAdapter(options.bus),
    };

    const shouldManage =
      !options.adapters?.llm &&
      (llmMode === "managed" || (llmMode === "auto" && hasPlatformLlmCredentials()));

    if (shouldManage) {
      adapters = {
        ...adapters,
        llm: new ManagedLlmAdapter({ bus: options.bus }),
      };
    }
  }

  return new VerseCore({
    adapters,
    kernelBackend: options.kernelBackend,
    version: options.version,
    skillHost: options.skillHost,
    orchestrationHost: options.orchestrationHost,
    toolHost: options.toolHost,
    personaOverrides: options.personaOverrides,
    memoryStore: options.memoryStore,
    memorySummarizer: options.memorySummarizer,
    vectorIndex: options.vectorIndex,
    semanticMemoryEnabled: options.semanticMemoryEnabled,
    toolAudit: options.toolAudit,
    secretsVault: options.secretsVault,
    connectorStore: options.connectorStore,
    oauthConnector: options.oauthConnector,
  } satisfies VerseCoreOptions);
}
