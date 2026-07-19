import type { KernelClient, KernelContext } from "@at72-verse/contracts";
import type { VerseCoreAdapters } from "../adapters/ports.js";
import type { SkillHostPort } from "../skills/skill-host-port.js";
import type { OrchestrationHostPort } from "../orchestration/orchestration-host-port.js";
import type { PersonaOverridePort } from "../persona/persona-engine.js";
import { PersonaEngine } from "../persona/persona-engine.js";
import {
  DeterministicConversationSummarizer,
  type ConversationSummarizerPort,
} from "../memory/conversation-summarizer.js";
import { InMemoryMemoryStore } from "../memory/in-memory-store.js";
import { InMemoryVectorIndex } from "../memory/in-memory-vector-index.js";
import { MemoryGateway } from "../memory/memory-gateway.js";
import { MemoryGatewayAdapter } from "../memory/memory-gateway-adapter.js";
import type { MemoryStorePort } from "../memory/memory-store-port.js";
import type { VectorIndexPort } from "../memory/vector-index-port.js";
import type { ToolHostPort } from "../tools/tool-host-port.js";
import type { ToolExecutionAuditPort } from "../tools/tool-audit-port.js";
import { ToolRuntime } from "../tools/tool-runtime.js";
import { PermissionEngine } from "../permissions/permission-engine.js";
import { CostEngine } from "../cost/cost-engine.js";
import type { VerseCoreHealthReport } from "./health-types.js";
import { CORE_MODULE_MANIFEST } from "../modules/manifest.js";
import { CoreKernelClient } from "../kernel/core-kernel-client.js";
import { LocalEncryptedSecretsVault } from "../vault/local-encrypted-secrets-vault.js";
import type { SecretsVaultPort } from "../vault/secrets-vault-port.js";
import { InMemoryConnectorStore, type ConnectorStorePort } from "../connectors/connector-store-port.js";
import { OAuthConnector } from "../connectors/oauth-connector.js";

export const VERSE_CORE_VERSION = "0.0.0-phase08" as const;

export type VerseCoreOptions = {
  adapters: VerseCoreAdapters;
  /** Reported in health — set by the host (API), never by agents. */
  kernelBackend?: "stub" | "core";
  version?: string;
  skillHost?: SkillHostPort;
  orchestrationHost?: OrchestrationHostPort;
  toolHost?: ToolHostPort;
  personaOverrides?: PersonaOverridePort;
  /** Persistence for Memory Gateway (default: in-process store). */
  memoryStore?: MemoryStorePort;
  /** Vector index (default: in-process). Kernel never sees this. */
  vectorIndex?: VectorIndexPort;
  /** Kill-switch for semantic recall (Phase 25). Default: env VERSE_SEMANTIC_MEMORY. */
  semanticMemoryEnabled?: boolean;
  /** Summarizer strategy (default: deterministic concat — DL8). */
  memorySummarizer?: ConversationSummarizerPort;
  toolAudit?: ToolExecutionAuditPort;
  /** Phase 28a — SecretsVaultPort (default: local encrypted + in-memory cipher store). */
  secretsVault?: SecretsVaultPort;
  /** Phase 28a — connector metadata store. */
  connectorStore?: ConnectorStorePort;
  /** Phase 28a — OAuthConnector (default constructed from vault+store). */
  oauthConnector?: OAuthConnector;
};

/**
 * Public façade (ADR-001). Orchestrates modules/adapters — no agent-specific logic.
 */
export class VerseCore {
  private adapters: VerseCoreAdapters;
  private readonly kernelBackend: "stub" | "core";
  private readonly version: string;
  private readonly startedAt: Date;
  private skillHost: SkillHostPort | undefined;
  private orchestrationHost: OrchestrationHostPort | undefined;
  private personaEngine: PersonaEngine;
  private memoryGateway: MemoryGateway;
  private toolRuntime: ToolRuntime;
  private readonly permissionEngine: PermissionEngine;
  private readonly costEngine: CostEngine;
  private secretsVault: SecretsVaultPort;
  private connectorStore: ConnectorStorePort;
  private oauthConnector: OAuthConnector;

  constructor(options: VerseCoreOptions) {
    this.kernelBackend = options.kernelBackend ?? "stub";
    this.version = options.version ?? VERSE_CORE_VERSION;
    this.startedAt = new Date();
    this.skillHost = options.skillHost;
    this.orchestrationHost = options.orchestrationHost;
    this.personaEngine = new PersonaEngine(undefined, options.personaOverrides);
    this.permissionEngine = new PermissionEngine();
    this.costEngine = new CostEngine();

    this.secretsVault = options.secretsVault ?? new LocalEncryptedSecretsVault();
    this.connectorStore = options.connectorStore ?? new InMemoryConnectorStore();
    this.oauthConnector =
      options.oauthConnector ??
      new OAuthConnector({
        vault: this.secretsVault,
        store: this.connectorStore,
      });

    const store = options.memoryStore ?? new InMemoryMemoryStore();
    const summarizer = options.memorySummarizer ?? new DeterministicConversationSummarizer();
    const vectorIndex = options.vectorIndex ?? new InMemoryVectorIndex();
    this.memoryGateway = new MemoryGateway({
      store,
      personaEngine: this.personaEngine,
      summarizer,
      vectorIndex,
      semanticEnabled: options.semanticMemoryEnabled,
      embed: async (texts, context) => {
        const result = await this.adapters.llm.embed(
          { profile: "fast-cheap", input: texts },
          context,
        );
        return result.vectors;
      },
    });

    this.toolRuntime = new ToolRuntime({
      host: options.toolHost,
      personaEngine: this.personaEngine,
      permissionEngine: this.permissionEngine,
      audit: options.toolAudit,
    });

    this.adapters = {
      ...options.adapters,
      memory: new MemoryGatewayAdapter(this.memoryGateway),
    };
  }

  setSkillHost(skillHost: SkillHostPort | undefined): void {
    this.skillHost = skillHost;
  }

  setOrchestrationHost(orchestrationHost: OrchestrationHostPort | undefined): void {
    this.orchestrationHost = orchestrationHost;
  }

  setToolHost(toolHost: ToolHostPort | undefined): void {
    this.toolRuntime.setHost(toolHost);
  }

  setToolAudit(audit: ToolExecutionAuditPort): void {
    this.toolRuntime.setAudit(audit);
  }

  setPersonaOverrides(port: PersonaOverridePort | undefined): void {
    this.personaEngine = new PersonaEngine(undefined, port);
    this.memoryGateway.setPersonaEngine(this.personaEngine);
    this.toolRuntime.setPersonaEngine(this.personaEngine);
  }

  setMemoryStore(store: MemoryStorePort): void {
    this.memoryGateway.setStore(store);
  }

  setVectorIndex(index: VectorIndexPort | undefined): void {
    this.memoryGateway.setVectorIndex(index);
  }

  setSemanticMemoryEnabled(enabled: boolean): void {
    this.memoryGateway.setSemanticEnabled(enabled);
  }

  setMemorySummarizer(summarizer: ConversationSummarizerPort): void {
    this.memoryGateway.setSummarizer(summarizer);
  }

  getPersonaEngine(): PersonaEngine {
    return this.personaEngine;
  }

  getMemoryGateway(): MemoryGateway {
    return this.memoryGateway;
  }

  getToolRuntime(): ToolRuntime {
    return this.toolRuntime;
  }

  getPermissionEngine(): PermissionEngine {
    return this.permissionEngine;
  }

  getCostEngine(): CostEngine {
    return this.costEngine;
  }

  getSecretsVault(): SecretsVaultPort {
    return this.secretsVault;
  }

  setSecretsVault(vault: SecretsVaultPort): void {
    this.secretsVault = vault;
    this.oauthConnector.setVault(vault);
  }

  getConnectorStore(): ConnectorStorePort {
    return this.connectorStore;
  }

  setConnectorStore(store: ConnectorStorePort): void {
    this.connectorStore = store;
    this.oauthConnector.setStore(store);
  }

  getOAuthConnector(): OAuthConnector {
    return this.oauthConnector;
  }

  async health(): Promise<VerseCoreHealthReport> {
    const adapterHealth = await Promise.all([
      this.adapters.llm.health(),
      this.adapters.memory.health(),
      this.adapters.bus.health(),
      this.adapters.database.health(),
      this.adapters.objectStorage.health(),
      this.adapters.vector.health(),
    ]);

    const degraded = adapterHealth.some((a) => a.status === "degraded" || a.status === "down");

    return {
      status: degraded ? "degraded" : "ok",
      version: this.version,
      uptime_ms: Date.now() - this.startedAt.getTime(),
      started_at: this.startedAt.toISOString(),
      modules: [...CORE_MODULE_MANIFEST],
      adapters: adapterHealth,
      kernel_backend: this.kernelBackend,
    };
  }

  getModuleManifest() {
    return [...CORE_MODULE_MANIFEST];
  }

  createKernelClient(context: KernelContext): KernelClient {
    return new CoreKernelClient(
      context,
      this.adapters,
      this.skillHost,
      this.orchestrationHost,
      this.personaEngine,
      this.memoryGateway,
      this.toolRuntime,
      this.permissionEngine,
      this.costEngine,
    );
  }
}
