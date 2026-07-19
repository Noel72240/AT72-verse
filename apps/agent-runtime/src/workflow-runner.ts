/**
 * Bus-driven workflow runner (Phase 26).
 * Runtime hosts OrchestrationHost — Engine advances via Kernel only.
 */
import { randomUUID } from "node:crypto";
import type { Bus, BusMessage, BusUnsubscribe } from "@at72-verse/bus";
import type { PrismaClient } from "@at72-verse/db";
import type { WorkflowDefinition, WorkflowRunStatus } from "@at72-verse/contracts";
import {
  getWorkflowDefinitionById,
  WorkflowEngine,
  type VerseCore,
  type WorkflowEngineState,
} from "@at72-verse/verse-core";
import { createKernelClient } from "@at72-verse/verse-kernel";

export const WORKFLOW_TASKS_TOPIC = "verse.workflow.tasks" as const;

export type WorkflowTaskPayload = {
  action: "start" | "resume";
  workflow_run_id: string;
  organization_id: string;
  workspace_id: string;
  run_id: string;
  trace_id: string;
  definition: WorkflowDefinition;
  input: Record<string, unknown>;
  grants_snapshot?: unknown;
  budget_snapshot?: unknown;
  packages_snapshot?: unknown;
};

export type WorkflowRunnerHandle = {
  stop: () => Promise<void>;
};

export async function startWorkflowRunner(options: {
  bus: Bus;
  core: VerseCore;
  prisma?: PrismaClient;
  consumerGroup?: string;
}): Promise<WorkflowRunnerHandle> {
  const engine = new WorkflowEngine();
  const unsub = await options.bus.subscribe(
    {
      topic: WORKFLOW_TASKS_TOPIC,
      consumer_group: options.consumerGroup ?? "workflow-runner",
    },
    async (message) => {
      await handleWorkflowTask({
        message,
        bus: options.bus,
        core: options.core,
        prisma: options.prisma,
        engine,
      });
    },
  );

  return {
    stop: async () => {
      await unsub();
    },
  };
}

async function handleWorkflowTask(input: {
  message: BusMessage;
  bus: Bus;
  core: VerseCore;
  prisma?: PrismaClient;
  engine: WorkflowEngine;
}): Promise<void> {
  const payload = input.message.payload as WorkflowTaskPayload;
  if (payload.action !== "start" && payload.action !== "resume") return;

  const definition =
    payload.definition ?? getWorkflowDefinitionById("content-campaign");
  if (!definition) return;

  let prior: WorkflowEngineState | undefined;
  if (payload.action === "resume" && input.prisma) {
    const row = await input.prisma.workflowRunRow.findUnique({
      where: { id: payload.workflow_run_id },
    });
    if (row?.engineState && typeof row.engineState === "object") {
      prior = row.engineState as unknown as WorkflowEngineState;
    }
  }

  const kernel = createKernelClient({
    backend: "core",
    coreFactory: (ctx) => input.core.createKernelClient(ctx),
    context: {
      run_id: payload.run_id,
      agent_id: "adam",
      organization_id: payload.organization_id,
      workspace_id: payload.workspace_id,
      trace_id: payload.trace_id,
      step_id: randomUUID(),
      grants_snapshot: (payload.grants_snapshot as never) ?? null,
      budget_snapshot: (payload.budget_snapshot as never) ?? null,
      packages_snapshot: (payload.packages_snapshot as never) ?? null,
      delegation_depth: 0,
    },
  });

  const state = await input.engine.advance({
    kernel,
    definition,
    input: payload.input ?? {},
    state: prior,
  });

  if (input.prisma) {
    await persistEngineState(input.prisma, payload.workflow_run_id, payload.run_id, state);
  }

  await input.bus.publish(
    {
      event_id: randomUUID(),
      correlation_id: payload.trace_id,
      causation_id: input.message.event_id,
      tenant_id: payload.organization_id,
      workspace_id: payload.workspace_id,
      run_id: payload.run_id,
      timestamp: new Date().toISOString(),
      version: "1",
      event_type: "workflow.run.updated",
      payload: {
        workflow_run_id: payload.workflow_run_id,
        run_id: payload.run_id,
        status: state.status,
        completed_step_ids: state.completed_step_ids,
        cursor_step_id: state.cursor_step_id,
        step_outputs: state.step_outputs,
        error: state.error ?? null,
        engine_state: state,
      },
    },
    { topic: "verse.workflow.events" },
  );
}

async function persistEngineState(
  prisma: PrismaClient,
  workflowRunId: string,
  runId: string,
  state: WorkflowEngineState,
): Promise<void> {
  const status = state.status as WorkflowRunStatus;
  const now = new Date();
  await prisma.workflowRunRow.update({
    where: { id: workflowRunId },
    data: {
      status,
      completedStepIds: state.completed_step_ids,
      cursorStepId: state.cursor_step_id,
      engineState: state as object,
      output: state.step_outputs as object,
      error: state.error ? { message: state.error } : undefined,
      startedAt: status === "queued" ? undefined : now,
      completedAt: status === "completed" || status === "failed" ? now : null,
    },
  });

  if (status === "completed" || status === "failed") {
    await prisma.run.update({
      where: { id: runId },
      data: {
        status: status === "completed" ? "completed" : "failed",
        completedAt: now,
        error: state.error ? { message: state.error } : undefined,
      },
    });
  } else if (status === "waiting_checkpoint" || status === "paused") {
    await prisma.run.update({
      where: { id: runId },
      data: { status: "running", startedAt: now },
    });
  } else if (status === "running") {
    await prisma.run.update({
      where: { id: runId },
      data: { status: "running", startedAt: now },
    });
  }
}

/** Test helper — advance without bus. */
export async function executeWorkflowInline(input: {
  core: VerseCore;
  definition: WorkflowDefinition;
  runId: string;
  organizationId: string;
  workspaceId: string;
  traceId: string;
  brief: string;
  prior?: WorkflowEngineState;
  grants_snapshot?: unknown;
  budget_snapshot?: unknown;
  packages_snapshot?: unknown;
}): Promise<WorkflowEngineState> {
  const engine = new WorkflowEngine();
  const kernel = createKernelClient({
    backend: "core",
    coreFactory: (ctx) => input.core.createKernelClient(ctx),
    context: {
      run_id: input.runId,
      agent_id: "adam",
      organization_id: input.organizationId,
      workspace_id: input.workspaceId,
      trace_id: input.traceId,
      step_id: randomUUID(),
      grants_snapshot: (input.grants_snapshot as never) ?? null,
      budget_snapshot: (input.budget_snapshot as never) ?? null,
      packages_snapshot: (input.packages_snapshot as never) ?? null,
      delegation_depth: 0,
    },
  });
  return engine.advance({
    kernel,
    definition: input.definition,
    input: { brief: input.brief },
    state: input.prior,
  });
}
