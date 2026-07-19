/**
 * KernelClient backed by Verse Core adapters (Phase 08 Decision L2).
 * Agents still only see KernelClient — never Core internals.
 * Skills invoke via host SkillHostPort (Phase 14 / BB1).
 * Orchestration.delegate via host OrchestrationHostPort (Phase 15 / BO1).
 */
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
} from "@at72-verse/contracts";
import { KernelError } from "@at72-verse/verse-kernel";
import { createHash } from "node:crypto";
import type { VerseCoreAdapters } from "../adapters/ports.js";
import type { OrchestrationHostPort } from "../orchestration/orchestration-host-port.js";
import type { PersonaEngine } from "../persona/persona-engine.js";
import type { SkillHostPort } from "../skills/skill-host-port.js";
import type { MemoryGateway } from "../memory/memory-gateway.js";
import type { ToolRuntime } from "../tools/tool-runtime.js";
import type { PermissionEngine } from "../permissions/permission-engine.js";
import type { CostEngine } from "../cost/cost-engine.js";
import { resolveModelRoute } from "../llm/model-router.js";
import {
  assertCapabilityInstalled,
  findCatalogEntryByCapability,
} from "../registry/package-install-gate.js";

function digest(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export class CoreKernelClient implements KernelClient {
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

  constructor(
    context: KernelContext,
    private readonly adapters: VerseCoreAdapters,
    private readonly skillHost?: SkillHostPort,
    private readonly orchestrationHost?: OrchestrationHostPort,
    private readonly personaEngine?: PersonaEngine,
    private readonly memoryGateway?: MemoryGateway,
    private readonly toolRuntime?: ToolRuntime,
    private readonly permissionEngine?: PermissionEngine,
    private readonly costEngine?: CostEngine,
  ) {
    this.context = Object.freeze({ ...context });
    if (this.costEngine && this.context.budget_snapshot) {
      this.costEngine.bindSnapshot(this.context.budget_snapshot);
    }

    this.llm = {
      complete: async (request) => {
        const runComplete = async () => {
          // Hard-stop only when a frozen budget_snapshot is present (DO6 · production path).
          if (this.costEngine && this.context.budget_snapshot) {
            this.costEngine.assertCanStartLlmCall(this.context);
          }
          const result = await this.adapters.llm.complete(request, this.context);
          if (this.costEngine && this.context.budget_snapshot) {
            const route = resolveModelRoute(request.profile);
            this.costEngine.recordLlmUsage({
              context: this.context,
              model: route.model,
              input_tokens: result.usage.input_tokens,
              output_tokens: result.usage.output_tokens,
            });
          }
          return result;
        };
        // Phase 24 / DR8 — serialize budget assert+record per run_id (parallel fan-out safe).
        if (this.costEngine && this.context.budget_snapshot) {
          return this.costEngine.runExclusive(this.context.run_id, runComplete);
        }
        return runComplete();
      },
      embed: async (request) => {
        const runEmbed = async () => {
          const result = await this.adapters.llm.embed(request, this.context);
          if (this.costEngine && this.context.budget_snapshot) {
            const texts = Array.isArray(request.input) ? request.input : [request.input];
            const approxTokens = texts.reduce((n, t) => n + Math.ceil(t.length / 4), 0);
            this.costEngine.assertCanStartLlmCall(this.context);
            this.costEngine.recordLlmUsage({
              context: this.context,
              model: "text-embedding-3-small",
              input_tokens: approxTokens,
              output_tokens: 0,
            });
          }
          return result;
        };
        if (this.costEngine && this.context.budget_snapshot && this.context.run_id) {
          return this.costEngine.runExclusive(this.context.run_id, runEmbed);
        }
        return runEmbed();
      },
      stream: () => ({
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
    };

    this.memory = {
      remember: (request) => {
        if (!this.memoryGateway) {
          return this.adapters.memory.remember(request, this.context);
        }
        return this.memoryGateway.remember(request, this.context);
      },
      recall: (request) => {
        if (!this.memoryGateway) {
          return this.adapters.memory.recall(request, this.context);
        }
        return this.memoryGateway.recall(request, this.context);
      },
      summarize: async (scope) => {
        if (!this.memoryGateway) {
          throw new KernelError(
            "UNAVAILABLE",
            "Kernel.memory.summarize requires MemoryGateway (Phase 18)",
            { details: { family: "memory", method: "summarize" } },
          );
        }
        return this.memoryGateway.summarize(scope, this.context);
      },
      forget: async (id) => {
        if (!this.memoryGateway) {
          throw new KernelError(
            "UNAVAILABLE",
            "Kernel.memory.forget requires MemoryGateway (Phase 25)",
            { details: { family: "memory", method: "forget" } },
          );
        }
        await this.memoryGateway.forget(id, this.context);
      },
      pin: async (id) => {
        if (!this.memoryGateway) {
          throw new KernelError(
            "UNAVAILABLE",
            "Kernel.memory.pin requires MemoryGateway (Phase 25)",
            { details: { family: "memory", method: "pin" } },
          );
        }
        await this.memoryGateway.pin(id, this.context);
      },
      link: async () => {
        throw new KernelError("UNAVAILABLE", "Kernel.memory.link is not implemented (Phase 25)", {
          details: { family: "memory", method: "link" },
        });
      },
    };

    this.tools = {
      execute: async (request) => {
        if (!this.toolRuntime) {
          throw new KernelError(
            "UNAVAILABLE",
            "Kernel.tools.execute requires ToolRuntime (Phase 19)",
            { details: { tool_id: request.tool_id } },
          );
        }
        return this.toolRuntime.execute(request, this.context);
      },
      listAvailable: async () => {
        if (!this.toolRuntime) return [];
        return this.toolRuntime.listAvailable(this.context);
      },
    };

    this.skills = {
      invoke: async (request) => {
        if (!this.skillHost) {
          throw new KernelError(
            "UNAVAILABLE",
            "Kernel.skills.invoke requires a host Skill registry (Phase 14 / BB1)",
            { details: { skill_id: request.skill_id } },
          );
        }
        assertCapabilityInstalled({
          packages_snapshot: this.context.packages_snapshot,
          kind: "skill",
          capability_id: request.skill_id,
        });
        if (this.permissionEngine) {
          const decision = this.permissionEngine.evaluateSkillInvoke({
            skill_id: request.skill_id,
            grants_snapshot: this.context.grants_snapshot,
          });
          this.permissionEngine.assertAllowed(
            decision,
            `Skill not allowed: ${request.skill_id}`,
          );
        }
        return this.skillHost.invoke(request.skill_id, request.input, this);
      },
      resolve: async (skillId) => {
        if (!this.skillHost) {
          throw new KernelError(
            "UNAVAILABLE",
            "Kernel.skills.resolve requires a host Skill registry (Phase 14 / BB1)",
            { details: { skill_id: skillId } },
          );
        }
        return this.skillHost.resolve(skillId);
      },
    };

    this.persona = {
      resolve: async (agentId) => {
        if (!this.personaEngine) {
          throw new KernelError(
            "UNAVAILABLE",
            "Kernel.persona.resolve requires PersonaEngine (Phase 17)",
            { details: { agent_id: agentId } },
          );
        }
        return this.personaEngine.resolve(
          agentId,
          this.context.organization_id,
          this.context.workspace_id,
        );
      },
    };

    this.orchestration = {
      delegate: async (request) => {
        this.assertOrchestrationUnlocked("delegate");
        if (!this.orchestrationHost) {
          throw new KernelError(
            "UNAVAILABLE",
            "Kernel.orchestration.delegate requires a host OrchestrationHost (Phase 15 / BO1)",
            { details: { target_agent: request.target_agent } },
          );
        }
        return this.orchestrationHost.delegate({
          target_agent: request.target_agent,
          task: request.task,
          deadline_at: request.deadline_at,
          run_id: this.context.run_id,
          trace_id: this.context.trace_id,
          parent_step_id: this.context.step_id ?? null,
          caller_agent_id: this.context.agent_id,
          caller_delegation_depth: this.context.delegation_depth ?? 0,
          organization_id: this.context.organization_id,
          workspace_id: this.context.workspace_id,
          conversation_id: this.context.conversation_id ?? null,
          user_id: this.context.user_id,
          grants_snapshot: this.context.grants_snapshot ?? null,
          budget_snapshot: this.context.budget_snapshot ?? null,
          packages_snapshot: this.context.packages_snapshot ?? null,
        });
      },
      delegateMany: async (request) => {
        this.assertOrchestrationUnlocked("delegateMany");
        if (!this.orchestrationHost) {
          throw new KernelError(
            "UNAVAILABLE",
            "Kernel.orchestration.delegateMany requires a host OrchestrationHost (Phase 24 / DR2)",
            { details: { target_count: request.targets.length } },
          );
        }
        return this.orchestrationHost.delegateMany({
          targets: request.targets,
          deadline_at: request.deadline_at,
          run_id: this.context.run_id,
          trace_id: this.context.trace_id,
          parent_step_id: this.context.step_id ?? null,
          caller_agent_id: this.context.agent_id,
          caller_delegation_depth: this.context.delegation_depth ?? 0,
          organization_id: this.context.organization_id,
          workspace_id: this.context.workspace_id,
          conversation_id: this.context.conversation_id ?? null,
          user_id: this.context.user_id,
          grants_snapshot: this.context.grants_snapshot ?? null,
          budget_snapshot: this.context.budget_snapshot ?? null,
          packages_snapshot: this.context.packages_snapshot ?? null,
        });
      },
      ask: async (targetAgent, question) => {
        this.assertOrchestrationUnlocked("ask");
        if (!this.orchestrationHost) {
          throw new KernelError(
            "UNAVAILABLE",
            "Kernel.orchestration.ask requires a host OrchestrationHost (Phase 24 / DR6)",
            { details: { target_agent: targetAgent } },
          );
        }
        return this.orchestrationHost.ask({
          target_agent: targetAgent,
          question,
          run_id: this.context.run_id,
          trace_id: this.context.trace_id,
          parent_step_id: this.context.step_id ?? null,
          caller_agent_id: this.context.agent_id,
          caller_delegation_depth: this.context.delegation_depth ?? 0,
          organization_id: this.context.organization_id,
          workspace_id: this.context.workspace_id,
          conversation_id: this.context.conversation_id ?? null,
          user_id: this.context.user_id,
          grants_snapshot: this.context.grants_snapshot ?? null,
          budget_snapshot: this.context.budget_snapshot ?? null,
          packages_snapshot: this.context.packages_snapshot ?? null,
        });
      },
      completeTask: async () => undefined,
      requestHitl: async (reason) => ({
        approval_id: `hitl_${digest({ run: this.context.run_id, reason }).slice(0, 16)}`,
      }),
    };

    this.events = {
      emit: async (eventType, payload) => {
        await this.adapters.bus.publish(eventType, payload, this.context);
      },
    };

    this.artifacts = {
      write: async (name) => ({
        artifact_id: `art_${digest({ run: this.context.run_id, name }).slice(0, 16)}`,
      }),
      read: async () => null,
      list: async () => [],
    };

    this.cost = {
      estimate: async (profile, approxTokens) => {
        if (!this.costEngine) {
          return { usd: Number((approxTokens * 0.000002).toFixed(6)) };
        }
        return this.costEngine.estimate(profile, approxTokens);
      },
      getBudget: async () => {
        if (!this.costEngine) {
          return { remaining_usd: 10, remaining_tokens: 100_000 };
        }
        return this.costEngine.getBudget(this.context);
      },
    };

    this.registry = {
      getAgent: async (id) => {
        const entry = findCatalogEntryByCapability(id);
        if (!entry || entry.kind !== "agent") {
          throw new KernelError("NOT_FOUND", `Agent package not found: ${id}`, {
            details: { agent_id: id },
          });
        }
        return {
          id,
          package_id: entry.package_id,
          kind: entry.kind,
          version: entry.version,
          manifest: entry.manifest,
          via: "package-registry",
        };
      },
      getSkill: async (id) => {
        const entry = findCatalogEntryByCapability(id);
        if (!entry || entry.kind !== "skill") {
          throw new KernelError("NOT_FOUND", `Skill package not found: ${id}`, {
            details: { skill_id: id },
          });
        }
        return {
          id,
          package_id: entry.package_id,
          kind: entry.kind,
          version: entry.version,
          manifest: entry.manifest,
          via: "package-registry",
        };
      },
      getTool: async (id) => {
        const entry = findCatalogEntryByCapability(id);
        if (!entry || entry.kind !== "tool") {
          throw new KernelError("NOT_FOUND", `Tool package not found: ${id}`, {
            details: { tool_id: id },
          });
        }
        return {
          id,
          package_id: entry.package_id,
          kind: entry.kind,
          version: entry.version,
          manifest: entry.manifest,
          via: "package-registry",
        };
      },
    };

    this.files = {
      upload: async (path) => ({
        file_id: `file_${digest({ run: this.context.run_id, path }).slice(0, 16)}`,
      }),
      download: async () => new Uint8Array(),
    };
  }

  private assertOrchestrationUnlocked(method: string): void {
    if (this.context.orchestration_locked) {
      throw new KernelError(
        "FORBIDDEN",
        `Kernel.orchestration.${method} forbidden during consult (orchestration_locked)`,
        { details: { method, agent_id: this.context.agent_id } },
      );
    }
  }
}
