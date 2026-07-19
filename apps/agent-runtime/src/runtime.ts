import { randomUUID } from "node:crypto";
import type { Bus } from "@at72-verse/bus";
import {
  agentEventsTopic,
  agentTasksTopic,
  type BusMessage,
  type BusUnsubscribe,
} from "@at72-verse/bus";
import type { AgentTaskCompletedPayload, AgentTaskPayload } from "@at72-verse/contracts";
import {
  createStampedPersonaOverridePort,
  createVerseCore,
  runWithPersonaOverrides,
  assertCapabilityInstalled,
  type VerseCore,
} from "@at72-verse/verse-core";
import { createKernelClient, KernelError } from "@at72-verse/verse-kernel";
import { createOrchestrationHost } from "./orchestration-host.js";
import {
  createDefaultAgentRegistry,
  createDefaultSkillRegistry,
  createDefaultToolRegistry,
  createSkillHost,
  createToolHost,
  normalizeAgentTaskResult,
  type AgentPlugin,
  type AgentRegistry,
  type AgentTaskResult,
  type SkillRegistry,
  type ToolRegistry,
} from "./registry.js";
import { startWorkflowRunner, type WorkflowRunnerHandle } from "./workflow-runner.js";
import type { PrismaClient } from "@at72-verse/db";

export type StartRuntimeOptions = {
  bus: Bus;
  /** Host Core (AR1). When omitted, Runtime creates one from the shared Bus. */
  core?: VerseCore;
  registry?: AgentRegistry;
  skills?: SkillRegistry;
  tools?: ToolRegistry;
  /** Consumer group for task subscriptions. */
  consumerGroup?: string;
  /** Optional Prisma — enables workflow_runs persistence from WorkflowRunner. */
  prisma?: PrismaClient;
  /** Enable Phase 26 workflow bus consumer (default true). */
  enableWorkflows?: boolean;
};

export type RuntimeHandle = {
  stop: () => Promise<void>;
  agents: string[];
  skills: string[];
  tools: string[];
  core: VerseCore;
};

/**
 * Long-lived runtime: agents + skills + tools registries (AN1 · BB1 · BO1 · DM3).
 * Hosts Verse Core façade; never mutates Runs.
 */
export async function startAgentRuntime(options: StartRuntimeOptions): Promise<RuntimeHandle> {
  const registry = options.registry ?? createDefaultAgentRegistry();
  const skills = options.skills ?? createDefaultSkillRegistry();
  const tools = options.tools ?? createDefaultToolRegistry();
  const core =
    options.core ??
    createVerseCore({
      bus: options.bus,
      kernelBackend: "core",
    });
  core.setPersonaOverrides(createStampedPersonaOverridePort());
  core.setSkillHost(createSkillHost(skills));
  core.setToolHost(createToolHost(tools));
  core.setOrchestrationHost(
    createOrchestrationHost({
      bus: options.bus,
      core,
      registry,
    }),
  );

  const group = options.consumerGroup ?? "agent-runtime";
  const unsubs: BusUnsubscribe[] = [];
  let workflowRunner: WorkflowRunnerHandle | undefined;

  for (const plugin of registry.values()) {
    const topic = agentTasksTopic(plugin.id);
    const unsub = await options.bus.subscribe({ topic, consumer_group: group }, async (message) => {
      await executeAgentTask(options.bus, core, plugin, message);
    });
    unsubs.push(unsub);
  }

  if (options.enableWorkflows !== false) {
    workflowRunner = await startWorkflowRunner({
      bus: options.bus,
      core,
      prisma: options.prisma,
      consumerGroup: `${group}-workflows`,
    });
  }

  return {
    agents: [...registry.keys()],
    skills: [...skills.keys()],
    tools: [...tools.keys()],
    core,
    stop: async () => {
      if (workflowRunner) await workflowRunner.stop();
      core.setSkillHost(undefined);
      core.setToolHost(undefined);
      core.setOrchestrationHost(undefined);
      for (const u of unsubs) {
        await u();
      }
    },
  };
}

async function executeAgentTask(
  bus: Bus,
  core: VerseCore,
  plugin: AgentPlugin,
  message: BusMessage,
): Promise<void> {
  const payload = message.payload as AgentTaskPayload;
  const runId = payload.run_id ?? message.run_id;
  if (!runId) {
    throw new Error(`Task for agent ${plugin.id} missing run_id`);
  }
  const traceId = payload.trace_id ?? message.correlation_id;

  // DN7 — block disabled agents before handleTask().
  const agentDecision = core.getPermissionEngine().evaluateAgentRun({
    agent_id: plugin.id,
    grants_snapshot: payload.grants_snapshot,
  });
  if (!agentDecision.allowed) {
    const failed: AgentTaskCompletedPayload = {
      agent_id: plugin.id,
      run_id: runId,
      step_id: payload.step_id,
      trace_id: traceId,
      plan: { version: "1", steps: [] },
      status: "failed",
      error: `Agent not allowed: ${plugin.id} (${agentDecision.reasons.join(",")})`,
    };
    await publishTaskCompleted(bus, plugin.id, message, failed, traceId);
    return;
  }

  // DP9 — block agents whose package is not installed (packages_snapshot).
  try {
    assertCapabilityInstalled({
      packages_snapshot: payload.packages_snapshot,
      kind: "agent",
      capability_id: plugin.id,
    });
  } catch (err) {
    const failed: AgentTaskCompletedPayload = {
      agent_id: plugin.id,
      run_id: runId,
      step_id: payload.step_id,
      trace_id: traceId,
      plan: { version: "1", steps: [] },
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
    };
    await publishTaskCompleted(bus, plugin.id, message, failed, traceId);
    return;
  }

  const kernel = createKernelClient({
    backend: "core",
    coreFactory: (ctx) => core.createKernelClient(ctx),
    context: {
      run_id: runId,
      agent_id: plugin.id,
      organization_id: message.tenant_id,
      workspace_id: message.workspace_id,
      trace_id: traceId,
      user_id: payload.user_id ?? null,
      conversation_id: payload.conversation_id ?? null,
      tools_allowlist: plugin.tools_allowlist,
      grants_snapshot: payload.grants_snapshot ?? null,
      budget_snapshot: payload.budget_snapshot ?? null,
      packages_snapshot: payload.packages_snapshot ?? null,
      step_id: payload.step_id ?? null,
      delegation_depth: payload.delegation_depth ?? 0,
    },
  });

  try {
    const outcome = await runWithPersonaOverrides(
      {
        organization: payload.persona_org_override ?? null,
        workspace: payload.persona_workspace_override ?? null,
      },
      async () => normalizeAgentTaskResult(await plugin.handleTask({ kernel, message })),
    );
    const completed: AgentTaskCompletedPayload = {
      agent_id: plugin.id,
      run_id: runId,
      step_id: payload.step_id,
      trace_id: traceId,
      plan: outcome.plan,
      status: "completed",
      result: outcome.result,
      ...(outcome.resolved_persona ? { resolved_persona: outcome.resolved_persona } : {}),
    };
    await publishTaskCompleted(bus, plugin.id, message, completed, traceId);
  } catch (err) {
    const failed: AgentTaskCompletedPayload = {
      agent_id: plugin.id,
      run_id: runId,
      step_id: payload.step_id,
      trace_id: traceId,
      plan: { version: "1", steps: [] },
      status: "failed",
      error:
        err instanceof KernelError
          ? err.message
          : err instanceof Error
            ? err.message
            : String(err),
    };
    await publishTaskCompleted(bus, plugin.id, message, failed, traceId);
  }
}

async function publishTaskCompleted(
  bus: Bus,
  agentId: string,
  source: BusMessage,
  payload: AgentTaskCompletedPayload,
  traceId: string,
): Promise<void> {
  const message: BusMessage = {
    event_id: randomUUID(),
    correlation_id: traceId,
    causation_id: source.event_id,
    tenant_id: source.tenant_id,
    workspace_id: source.workspace_id,
    run_id: payload.run_id,
    timestamp: new Date().toISOString(),
    version: "1",
    event_type: "task.completed",
    payload: {
      ...payload,
      trace_id: traceId,
      run_id: payload.run_id,
    },
  };
  await bus.publish(message, { topic: agentEventsTopic(agentId) });
}

export {
  createDefaultAgentRegistry,
  createDefaultSkillRegistry,
  createDefaultToolRegistry,
  createSkillHost,
  createToolHost,
  normalizeAgentTaskResult,
};
export { createOrchestrationHost, MAX_DELEGATION_DEPTH, DELEGATION_ALLOW_LIST, buildDefaultDelegationAllowList } from "./orchestration-host.js";
export type { AgentPlugin, AgentRegistry, AgentTaskResult, SkillRegistry, ToolRegistry };
export const packageName = "@at72-verse/agent-runtime" as const;
