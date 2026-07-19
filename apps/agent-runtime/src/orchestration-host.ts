/**
 * In-process OrchestrationHost (Phase 15 / BO1 · BP1).
 * Contract is transport-agnostic — a future host may dispatch remotely without Kernel changes.
 */
import { randomUUID } from "node:crypto";
import type { Bus, BusMessage } from "@at72-verse/bus";
import { agentEventsTopic } from "@at72-verse/bus";
import type {
  AgentTaskCompletedPayload,
  AgentTaskConsultedPayload,
  AgentTaskDelegatedPayload,
  AgentTaskPayload,
  BudgetSnapshot,
  CapabilityGrantSnapshot,
  PackagesSnapshot,
  OrchestrationDelegateResult,
} from "@at72-verse/contracts";
import type { OrchestrationHostPort, VerseCore } from "@at72-verse/verse-core";
import {
  assertCapabilityInstalled,
  getPersonaOverrideStamp,
  runWithPersonaOverrides,
} from "@at72-verse/verse-core";
import { createKernelClient, KernelError } from "@at72-verse/verse-kernel";
import type { PrismaClient } from "@at72-verse/db";
import {
  normalizeAgentTaskResult,
  type AgentPlugin,
  type AgentRegistry,
} from "./registry.js";

/** P15 anti-loop policy (BV1). */
export const MAX_DELEGATION_DEPTH = 1;

/**
 * Build Adam → specialists allow-list from the Runtime agent registry (Phase 23).
 * New specialists need only registry registration — no OrchestrationHost code change.
 */
export function buildDefaultDelegationAllowList(
  registry: AgentRegistry,
): Readonly<Record<string, readonly string[]>> {
  const specialists = [...registry.keys()].filter((id) => id !== "adam").sort();
  // workflow-engine uses the same allow-list as Adam (Phase 26 / DT2) — not an agent plugin.
  return { adam: specialists, "workflow-engine": specialists };
}

/** @deprecated Prefer buildDefaultDelegationAllowList(registry) — static snapshot for docs/tests. */
export const DELEGATION_ALLOW_LIST: Readonly<Record<string, readonly string[]>> = {
  adam: ["astra", "nova", "orion", "pixel"],
  "workflow-engine": ["astra", "nova", "orion", "pixel"],
};

export type CreateOrchestrationHostOptions = {
  bus: Bus;
  core: VerseCore;
  registry: AgentRegistry;
  /**
   * Max nesting depth for delegate (caller depth must be &lt; this).
   * Default 1 — Adam may delegate once; specialists may not.
   */
  maxDelegationDepth?: number;
  allowList?: Readonly<Record<string, readonly string[]>>;
  /** When set, persist child RunStep before in-process execution (avoids tool audit FK races). */
  prisma?: PrismaClient;
};

/**
 * Builds an OrchestrationHostPort.
 * P15 executes the target agent in-process after recording the child step via Bus.
 * The same `delegate()` signature can later await a remote worker.
 */
export function createOrchestrationHost(
  options: CreateOrchestrationHostOptions,
): OrchestrationHostPort {
  const maxDepth = options.maxDelegationDepth ?? MAX_DELEGATION_DEPTH;
  const allowList = options.allowList ?? buildDefaultDelegationAllowList(options.registry);

  const host: OrchestrationHostPort = {
    async delegate(request): Promise<OrchestrationDelegateResult> {
      const allowed = allowList[request.caller_agent_id] ?? [];
      if (!allowed.includes(request.target_agent)) {
        throw new KernelError(
          "FORBIDDEN",
          `Delegation not allowed: ${request.caller_agent_id} → ${request.target_agent}`,
          {
            details: {
              caller_agent_id: request.caller_agent_id,
              target_agent: request.target_agent,
              allow_list: allowed,
            },
          },
        );
      }

      if (request.caller_delegation_depth >= maxDepth) {
        throw new KernelError(
          "FORBIDDEN",
          `Max delegation depth exceeded (${maxDepth})`,
          {
            details: {
              caller_delegation_depth: request.caller_delegation_depth,
              max_delegation_depth: maxDepth,
            },
          },
        );
      }

      const plugin = options.registry.get(request.target_agent);
      if (!plugin) {
        throw new KernelError("NOT_FOUND", `Agent not registered: ${request.target_agent}`, {
          details: { target_agent: request.target_agent },
        });
      }

      const childStepId = randomUUID();
      const childDepth = request.caller_delegation_depth + 1;

      await publishTaskDelegated(options.bus, {
        agent_id: request.target_agent,
        delegated_by: request.caller_agent_id,
        run_id: request.run_id,
        step_id: childStepId,
        parent_step_id: request.parent_step_id,
        trace_id: request.trace_id,
        task: request.task,
      }, {
        organizationId: request.organization_id,
        workspaceId: request.workspace_id,
      });

      await ensureChildRunStep(options.prisma, {
        runId: request.run_id,
        stepId: childStepId,
        parentStepId: request.parent_step_id,
        agentId: request.target_agent,
        name: `${request.target_agent}.delegated`,
        kind: "agent",
        input: {
          task: request.task,
          delegated_by: request.caller_agent_id,
          trace_id: request.trace_id,
        },
      });

      return executeAgentInProcess({
        bus: options.bus,
        core: options.core,
        plugin,
        request,
        childStepId,
        childDepth,
        orchestrationLocked: false,
      });
    },

    async delegateMany(request) {
      // Promise.all preserves input order (DR deterministic ordering).
      const results = await Promise.all(
        request.targets.map((t) =>
          host.delegate({
            target_agent: t.target_agent,
            task: t.task,
            run_id: request.run_id,
            trace_id: request.trace_id,
            parent_step_id: request.parent_step_id,
            caller_agent_id: request.caller_agent_id,
            caller_delegation_depth: request.caller_delegation_depth,
            organization_id: request.organization_id,
            workspace_id: request.workspace_id,
            conversation_id: request.conversation_id,
            user_id: request.user_id,
            grants_snapshot: request.grants_snapshot,
            budget_snapshot: request.budget_snapshot,
            packages_snapshot: request.packages_snapshot,
            deadline_at: request.deadline_at,
          }),
        ),
      );
      return { results };
    },

    async ask(request) {
      const caller = options.registry.get(request.caller_agent_id);
      const canConsult = caller?.can_consult ?? [];
      if (!canConsult.includes(request.target_agent)) {
        throw new KernelError(
          "FORBIDDEN",
          `Consult not allowed: ${request.caller_agent_id} → ${request.target_agent}`,
          {
            details: {
              caller_agent_id: request.caller_agent_id,
              target_agent: request.target_agent,
              can_consult: canConsult,
              reason: "can_consult_missing",
            },
          },
        );
      }

      const plugin = options.registry.get(request.target_agent);
      if (!plugin) {
        throw new KernelError("NOT_FOUND", `Agent not registered: ${request.target_agent}`, {
          details: { target_agent: request.target_agent },
        });
      }

      const childStepId = randomUUID();
      // DR6 — ask does NOT increment delegation_depth.
      const childDepth = request.caller_delegation_depth;

      await publishTaskConsulted(options.bus, {
        agent_id: request.target_agent,
        consulted_by: request.caller_agent_id,
        run_id: request.run_id,
        step_id: childStepId,
        parent_step_id: request.parent_step_id,
        trace_id: request.trace_id,
        question: request.question,
      }, {
        organizationId: request.organization_id,
        workspaceId: request.workspace_id,
      });

      await ensureChildRunStep(options.prisma, {
        runId: request.run_id,
        stepId: childStepId,
        parentStepId: request.parent_step_id,
        agentId: request.target_agent,
        name: `${request.target_agent}.consulted`,
        kind: "consult",
        input: {
          question: request.question,
          consulted_by: request.caller_agent_id,
          trace_id: request.trace_id,
        },
      });

      const outcome = await executeAgentInProcess({
        bus: options.bus,
        core: options.core,
        plugin,
        request: {
          target_agent: request.target_agent,
          task: {
            goal:
              typeof request.question.question === "string"
                ? request.question.question
                : typeof request.question.brief === "string"
                  ? request.question.brief
                  : "Consult request",
            ...request.question,
            consult: true,
          },
          run_id: request.run_id,
          trace_id: request.trace_id,
          parent_step_id: request.parent_step_id,
          organization_id: request.organization_id,
          workspace_id: request.workspace_id,
          conversation_id: request.conversation_id,
          user_id: request.user_id,
          grants_snapshot: request.grants_snapshot,
          budget_snapshot: request.budget_snapshot,
          packages_snapshot: request.packages_snapshot,
        },
        childStepId,
        childDepth,
        orchestrationLocked: true,
      });

      return {
        from: request.target_agent,
        answer: outcome.result ?? {},
        step_id: outcome.step_id,
        status: outcome.status,
        ...(outcome.error ? { error: outcome.error } : {}),
      };
    },
  };

  return host;
}

async function executeAgentInProcess(input: {
  bus: Bus;
  core: VerseCore;
  plugin: AgentPlugin;
  request: {
    target_agent: string;
    task: Record<string, unknown>;
    run_id: string;
    trace_id: string;
    parent_step_id: string | null;
    organization_id: string;
    workspace_id: string;
    conversation_id?: string | null;
    user_id?: string | null;
    grants_snapshot?: CapabilityGrantSnapshot | null;
    budget_snapshot?: BudgetSnapshot | null;
    packages_snapshot?: PackagesSnapshot | null;
  };
  childStepId: string;
  childDepth: number;
  orchestrationLocked: boolean;
}): Promise<OrchestrationDelegateResult> {
  const goal =
    typeof input.request.task.goal === "string"
      ? input.request.task.goal
      : typeof input.request.task.brief === "string"
        ? input.request.task.brief
        : undefined;

  const parentStamp = getPersonaOverrideStamp();
  const orgOverride =
    parentStamp?.organization ??
    (typeof input.request.task.persona_org_override === "object"
      ? (input.request.task.persona_org_override as AgentTaskPayload["persona_org_override"])
      : undefined);
  const wsOverride =
    parentStamp?.workspace ??
    (typeof input.request.task.persona_workspace_override === "object"
      ? (input.request.task.persona_workspace_override as AgentTaskPayload["persona_workspace_override"])
      : undefined);

  const grantsSnapshot = input.request.grants_snapshot ?? null;
  const budgetSnapshot = input.request.budget_snapshot ?? null;
  const packagesSnapshot = input.request.packages_snapshot ?? null;

  // DN7 — block disabled target agents before handleTask().
  const agentDecision = input.core.getPermissionEngine().evaluateAgentRun({
    agent_id: input.plugin.id,
    grants_snapshot: grantsSnapshot,
  });
  if (!agentDecision.allowed) {
    const error = `Agent not allowed: ${input.plugin.id} (${agentDecision.reasons.join(",")})`;
    const failed: AgentTaskCompletedPayload = {
      agent_id: input.plugin.id,
      run_id: input.request.run_id,
      step_id: input.childStepId,
      trace_id: input.request.trace_id,
      plan: { version: "1", steps: [] },
      status: "failed",
      error,
    };
    const message: BusMessage = {
      event_id: randomUUID(),
      correlation_id: input.request.trace_id,
      causation_id: input.childStepId,
      tenant_id: input.request.organization_id,
      workspace_id: input.request.workspace_id,
      run_id: input.request.run_id,
      timestamp: new Date().toISOString(),
      version: "1",
      event_type: "agent.task",
      payload: {},
    };
    await publishTaskCompleted(input.bus, input.plugin.id, message, failed);
    return {
      step_id: input.childStepId,
      status: "failed" as const,
      error,
    };
  }

  // DP9 — block uninstalled target agents (e.g. Nova uninstalled → Adam delegation fails cleanly).
  try {
    assertCapabilityInstalled({
      packages_snapshot: packagesSnapshot,
      kind: "agent",
      capability_id: input.plugin.id,
    });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    const failed: AgentTaskCompletedPayload = {
      agent_id: input.plugin.id,
      run_id: input.request.run_id,
      step_id: input.childStepId,
      trace_id: input.request.trace_id,
      plan: { version: "1", steps: [] },
      status: "failed",
      error,
    };
    const message: BusMessage = {
      event_id: randomUUID(),
      correlation_id: input.request.trace_id,
      causation_id: input.childStepId,
      tenant_id: input.request.organization_id,
      workspace_id: input.request.workspace_id,
      run_id: input.request.run_id,
      timestamp: new Date().toISOString(),
      version: "1",
      event_type: "agent.task",
      payload: {},
    };
    await publishTaskCompleted(input.bus, input.plugin.id, message, failed);
    return {
      step_id: input.childStepId,
      status: "failed" as const,
      error,
    };
  }

  const payload: AgentTaskPayload = {
    run_id: input.request.run_id,
    step_id: input.childStepId,
    parent_step_id: input.request.parent_step_id,
    goal,
    trace_id: input.request.trace_id,
    delegation_depth: input.childDepth,
    conversation_id: input.request.conversation_id ?? null,
    user_id: input.request.user_id ?? null,
    ...(grantsSnapshot ? { grants_snapshot: grantsSnapshot } : {}),
    ...(budgetSnapshot ? { budget_snapshot: budgetSnapshot } : {}),
    ...(packagesSnapshot ? { packages_snapshot: packagesSnapshot } : {}),
    ...(orgOverride ? { persona_org_override: orgOverride } : {}),
    ...(wsOverride ? { persona_workspace_override: wsOverride } : {}),
  };

  const message: BusMessage = {
    event_id: randomUUID(),
    correlation_id: input.request.trace_id,
    causation_id: input.childStepId,
    tenant_id: input.request.organization_id,
    workspace_id: input.request.workspace_id,
    run_id: input.request.run_id,
    timestamp: new Date().toISOString(),
    version: "1",
    event_type: "agent.task",
    payload: { ...payload, ...input.request.task },
  };

  const kernel = createKernelClient({
    backend: "core",
    coreFactory: (ctx) => input.core.createKernelClient(ctx),
    context: {
      run_id: input.request.run_id,
      agent_id: input.plugin.id,
      organization_id: input.request.organization_id,
      workspace_id: input.request.workspace_id,
      trace_id: input.request.trace_id,
      user_id: input.request.user_id ?? null,
      conversation_id: input.request.conversation_id ?? null,
      tools_allowlist: input.plugin.tools_allowlist ?? [],
      grants_snapshot: grantsSnapshot,
      budget_snapshot: budgetSnapshot,
      packages_snapshot: packagesSnapshot,
      step_id: input.childStepId,
      delegation_depth: input.childDepth,
      ...(input.orchestrationLocked ? { orchestration_locked: true } : {}),
    },
  });

  return runWithPersonaOverrides(
    {
      organization: payload.persona_org_override ?? null,
      workspace: payload.persona_workspace_override ?? null,
    },
    async () => {
      try {
        const outcome = normalizeAgentTaskResult(
          await input.plugin.handleTask({ kernel, message }),
        );
        const completed: AgentTaskCompletedPayload = {
          agent_id: input.plugin.id,
          run_id: input.request.run_id,
          step_id: input.childStepId,
          trace_id: input.request.trace_id,
          plan: outcome.plan,
          status: "completed",
          result: outcome.result,
          ...(outcome.resolved_persona ? { resolved_persona: outcome.resolved_persona } : {}),
        };
        await publishTaskCompleted(input.bus, input.plugin.id, message, completed);
        return {
          step_id: input.childStepId,
          status: "completed" as const,
          result: outcome.result,
        };
      } catch (err) {
        if (err instanceof KernelError && err.code === "WAITING_APPROVAL") {
          const approvalId =
            typeof err.details?.approval_id === "string" ? err.details.approval_id : undefined;
          const waiting: AgentTaskCompletedPayload = {
            agent_id: input.plugin.id,
            run_id: input.request.run_id,
            step_id: input.childStepId,
            trace_id: input.request.trace_id,
            plan: { version: "1", steps: [] },
            status: "waiting_approval",
            ...(approvalId ? { approval_id: approvalId } : {}),
          };
          await publishTaskCompleted(input.bus, input.plugin.id, message, waiting);
          return {
            step_id: input.childStepId,
            status: "failed" as const,
            error: "WAITING_APPROVAL",
          };
        }
        const error = err instanceof Error ? err.message : String(err);
        const failed: AgentTaskCompletedPayload = {
          agent_id: input.plugin.id,
          run_id: input.request.run_id,
          step_id: input.childStepId,
          trace_id: input.request.trace_id,
          plan: { version: "1", steps: [] },
          status: "failed",
          error,
        };
        await publishTaskCompleted(input.bus, input.plugin.id, message, failed);
        return {
          step_id: input.childStepId,
          status: "failed" as const,
          error,
        };
      }
    },
  );
}

async function ensureChildRunStep(
  prisma: PrismaClient | undefined,
  input: {
    runId: string;
    stepId: string;
    parentStepId: string | null;
    agentId: string;
    name: string;
    kind: string;
    input: Record<string, unknown>;
  },
): Promise<void> {
  if (!prisma) return;

  const run = await prisma.run.findUnique({ where: { id: input.runId } });
  if (!run) return;

  let parentStepId = input.parentStepId;
  if (parentStepId) {
    const parent = await prisma.runStep.findUnique({ where: { id: parentStepId } });
    if (!parent || parent.runId !== run.id) {
      parentStepId = null;
    }
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await prisma.runStep.findUnique({ where: { id: input.stepId } });
    if (existing) return;

    const agg = await prisma.runStep.aggregate({
      where: { runId: run.id },
      _max: { seq: true },
    });
    const seq = (agg._max.seq ?? 0) + 1;

    try {
      await prisma.runStep.create({
        data: {
          id: input.stepId,
          organizationId: run.organizationId,
          runId: run.id,
          parentStepId,
          seq,
          name: input.name,
          kind: input.kind,
          agentId: input.agentId,
          status: "running",
          input: input.input as never,
        },
      });
      return;
    } catch (err) {
      if (!isPrismaUniqueViolation(err)) throw err;
      // Race with API projector (same step id or seq) — retry or accept winner.
    }
  }
}

function isPrismaUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

async function publishTaskDelegated(
  bus: Bus,
  payload: AgentTaskDelegatedPayload,
  tenant: { organizationId: string; workspaceId: string },
): Promise<void> {
  const message: BusMessage = {
    event_id: randomUUID(),
    correlation_id: payload.trace_id,
    causation_id: payload.parent_step_id ?? payload.run_id,
    tenant_id: tenant.organizationId,
    workspace_id: tenant.workspaceId,
    run_id: payload.run_id,
    timestamp: new Date().toISOString(),
    version: "1",
    event_type: "task.delegated",
    payload: { ...payload },
  };
  await bus.publish(message, { topic: agentEventsTopic(payload.agent_id) });
}

async function publishTaskConsulted(
  bus: Bus,
  payload: AgentTaskConsultedPayload,
  tenant: { organizationId: string; workspaceId: string },
): Promise<void> {
  const message: BusMessage = {
    event_id: randomUUID(),
    correlation_id: payload.trace_id,
    causation_id: payload.parent_step_id ?? payload.run_id,
    tenant_id: tenant.organizationId,
    workspace_id: tenant.workspaceId,
    run_id: payload.run_id,
    timestamp: new Date().toISOString(),
    version: "1",
    event_type: "task.consulted",
    payload: { ...payload },
  };
  await bus.publish(message, { topic: agentEventsTopic(payload.agent_id) });
}

async function publishTaskCompleted(
  bus: Bus,
  agentId: string,
  source: BusMessage,
  payload: AgentTaskCompletedPayload,
): Promise<void> {
  const message: BusMessage = {
    event_id: randomUUID(),
    correlation_id: payload.trace_id,
    causation_id: source.event_id,
    tenant_id: source.tenant_id,
    workspace_id: source.workspace_id,
    run_id: payload.run_id,
    timestamp: new Date().toISOString(),
    version: "1",
    event_type: "task.completed",
    payload: {
      ...payload,
      trace_id: payload.trace_id,
      run_id: payload.run_id,
    },
  };
  await bus.publish(message, { topic: agentEventsTopic(agentId) });
}
