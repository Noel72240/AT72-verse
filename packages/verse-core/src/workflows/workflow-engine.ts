/**
 * Workflow Engine (Phase 26 / ADR-006 · DT2).
 * Not an agent — no business logic. Interprets WorkflowDefinition step kinds
 * and orchestrates exclusively via Kernel.orchestration / Kernel.memory.
 *
 * Extensibility: register new handlers for future kinds (condition, loop, wait, hitl)
 * without changing the advance loop.
 */
import type {
  KernelClient,
  WorkflowDefinition,
  WorkflowRunStatus,
  WorkflowStepSpec,
} from "@at72-verse/contracts";
import { KernelError } from "@at72-verse/verse-kernel";

export type WorkflowEngineState = {
  status: WorkflowRunStatus;
  completed_step_ids: string[];
  cursor_step_id: string | null;
  step_outputs: Record<string, unknown>;
  error?: string;
};

export type WorkflowStepHandlerContext = {
  kernel: KernelClient;
  definition: WorkflowDefinition;
  step: WorkflowStepSpec;
  /** User/workflow input (e.g. brief). */
  input: Record<string, unknown>;
  state: WorkflowEngineState;
};

export type WorkflowStepHandlerResult = {
  /** Output stored under step.id */
  output?: Record<string, unknown>;
  /** Pause engine until manual resume (checkpoint). */
  pause?: "waiting_checkpoint" | "paused";
};

export type WorkflowStepHandler = (
  ctx: WorkflowStepHandlerContext,
) => Promise<WorkflowStepHandlerResult>;

const DEFAULT_HANDLERS: Record<string, WorkflowStepHandler> = {
  async memory_remember(ctx) {
    const scope = ctx.step.scope ?? "run.working";
    const content =
      typeof ctx.input.brief === "string" && ctx.input.brief.trim()
        ? ctx.input.brief.trim()
        : typeof ctx.input.goal === "string" && ctx.input.goal.trim()
          ? ctx.input.goal.trim()
          : "Workflow brief";
    const record = await ctx.kernel.memory.remember({
      scope,
      content,
      type: "ephemeral",
    });
    return { output: { memory_id: record.id, scope, content } };
  },

  async fan_out(ctx) {
    const targets = ctx.step.targets ?? [];
    if (targets.length === 0) {
      throw new KernelError("INVALID_INPUT", "fan_out step requires targets", {
        details: { step_id: ctx.step.id },
      });
    }
    const many = await ctx.kernel.orchestration.delegateMany({
      targets: targets.map((target_agent) => ({
        target_agent,
        task: {
          from_memory: true,
          brief_scope: "run.working",
          goal: "(brief in run.working)",
          campaign_role: target_agent,
          workflow_step_id: ctx.step.id,
        },
      })),
    });
    const failed = many.results.find((r) => r.status !== "completed");
    if (failed) {
      throw new Error(failed.error ?? "Workflow fan_out specialist failed");
    }
    const aggregate: Record<string, unknown> = {};
    for (let i = 0; i < targets.length; i++) {
      aggregate[targets[i]!] = many.results[i]?.result ?? null;
    }
    return { output: { results: many.results, aggregate } };
  },

  async delegate(ctx) {
    const agent = ctx.step.agent;
    if (!agent) {
      throw new KernelError("INVALID_INPUT", "delegate step requires agent", {
        details: { step_id: ctx.step.id },
      });
    }
    const delegated = await ctx.kernel.orchestration.delegate({
      target_agent: agent,
      task: {
        from_memory: true,
        brief_scope: "run.working",
        goal: "(brief in run.working)",
        workflow_step_id: ctx.step.id,
      },
    });
    if (delegated.status !== "completed") {
      throw new Error(delegated.error ?? `${agent} delegation failed`);
    }
    return { output: { result: delegated.result ?? null, step_id: delegated.step_id } };
  },

  async checkpoint() {
    return { pause: "waiting_checkpoint", output: { gate: "checkpoint" } };
  },

  async noop() {
    return { output: { ok: true } };
  },
};

export type WorkflowEngineOptions = {
  /** Extra / override handlers for future node kinds. */
  handlers?: Record<string, WorkflowStepHandler>;
};

function readySteps(definition: WorkflowDefinition, completed: Set<string>): WorkflowStepSpec[] {
  return definition.steps.filter((s) => {
    if (completed.has(s.id)) return false;
    const needs = s.needs ?? [];
    return needs.every((n) => completed.has(n));
  });
}

/**
 * Pure-ish advance loop. Callers supply KernelClient (with OrchestrationHost).
 * No automatic retries — failures surface as failed status.
 */
export class WorkflowEngine {
  private readonly handlers: Record<string, WorkflowStepHandler>;

  constructor(options: WorkflowEngineOptions = {}) {
    this.handlers = { ...DEFAULT_HANDLERS, ...(options.handlers ?? {}) };
  }

  /** Register a handler for a new step kind (extensibility without engine rewrite). */
  registerHandler(kind: string, handler: WorkflowStepHandler): void {
    this.handlers[kind] = handler;
  }

  initialState(): WorkflowEngineState {
    return {
      status: "queued",
      completed_step_ids: [],
      cursor_step_id: null,
      step_outputs: {},
    };
  }

  /**
   * Run until checkpoint pause, completion, or failure.
   * When resuming from waiting_checkpoint, pass prior state (completed steps kept).
   */
  async advance(input: {
    kernel: KernelClient;
    definition: WorkflowDefinition;
    input: Record<string, unknown>;
    state?: WorkflowEngineState;
  }): Promise<WorkflowEngineState> {
    let state: WorkflowEngineState = {
      ...(input.state ?? this.initialState()),
      status: "running",
      error: undefined,
    };

    const completed = new Set(state.completed_step_ids);

    // Safety: max iterations = steps * 2
    const maxIter = Math.max(8, input.definition.steps.length * 3);
    for (let i = 0; i < maxIter; i++) {
      const ready = readySteps(input.definition, completed);
      if (ready.length === 0) {
        state = {
          ...state,
          status: "completed",
          cursor_step_id: null,
        };
        return state;
      }

      // P26: execute one ready step at a time (deterministic order by definition order).
      const ordered = [...ready].sort(
        (a, b) =>
          input.definition.steps.findIndex((s) => s.id === a.id) -
          input.definition.steps.findIndex((s) => s.id === b.id),
      );
      const step = ordered[0]!;
      state = { ...state, cursor_step_id: step.id, status: "running" };

      const handler = this.handlers[step.kind];
      if (!handler) {
        return {
          ...state,
          status: "failed",
          error: `Unsupported workflow step kind: ${step.kind}`,
        };
      }

      try {
        const result = await handler({
          kernel: input.kernel,
          definition: input.definition,
          step,
          input: input.input,
          state,
        });
        completed.add(step.id);
        state = {
          ...state,
          completed_step_ids: [...completed],
          step_outputs: {
            ...state.step_outputs,
            [step.id]: result.output ?? {},
          },
        };

        if (result.pause) {
          return {
            ...state,
            status: result.pause,
            cursor_step_id: step.id,
          };
        }
      } catch (err) {
        return {
          ...state,
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }

    return {
      ...state,
      status: "failed",
      error: "Workflow engine exceeded max iterations",
    };
  }
}

/** Built-in content-campaign definition (Phase 26 / DT3). */
export const CONTENT_CAMPAIGN_DEFINITION: WorkflowDefinition = {
  id: "content-campaign",
  version: "0.1.0",
  display_name: "Content Campaign",
  description: "Brief → parallel Nova + Astra + Pixel → checkpoint → finalize",
  trigger: "manual",
  steps: [
    { id: "ingest_brief", kind: "memory_remember", scope: "run.working" },
    {
      id: "specialists",
      kind: "fan_out",
      needs: ["ingest_brief"],
      targets: ["nova", "astra", "pixel"],
    },
    { id: "review_gate", kind: "checkpoint", needs: ["specialists"] },
    { id: "finalize", kind: "noop", needs: ["review_gate"] },
  ],
};

export function getFirstPartyWorkflowDefinitions(): WorkflowDefinition[] {
  return [CONTENT_CAMPAIGN_DEFINITION];
}

export function getWorkflowDefinitionById(id: string): WorkflowDefinition | undefined {
  return getFirstPartyWorkflowDefinitions().find((d) => d.id === id);
}
