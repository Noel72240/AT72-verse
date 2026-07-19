import { randomUUID } from "node:crypto";
import type { Bus, BusMessage } from "@at72-verse/bus";
import { agentTasksTopic } from "@at72-verse/bus";
import type {
  AgentTaskPayload,
  BudgetSnapshot,
  CapabilityGrantSnapshot,
  PackagesSnapshot,
  PersonaSpecPatch,
  Run as ContractRun,
  RunStep as ContractRunStep,
} from "@at72-verse/contracts";

/**
 * AJ1 — dispatch run to agent task topic after persistence.
 * Phase 17: stamps persona org/workspace overrides on the payload (no Prisma in Runtime).
 * Phase 18: stamps conversation_id + user_id for Memory L1/L2 context.
 * Phase 20: stamps grants_snapshot frozen at dispatch (DN8).
 * Phase 21: stamps budget_snapshot frozen at dispatch (DO6).
 * Phase 22: stamps packages_snapshot frozen at dispatch (DP9).
 */
export async function dispatchAgentTask(
  bus: Bus,
  input: {
    agentId: string;
    run: ContractRun;
    step: ContractRunStep;
    goal?: string;
    traceId?: string;
    personaOrgOverride?: PersonaSpecPatch;
    personaWorkspaceOverride?: PersonaSpecPatch;
    grantsSnapshot?: CapabilityGrantSnapshot;
    budgetSnapshot?: BudgetSnapshot;
    packagesSnapshot?: PackagesSnapshot;
  },
): Promise<string> {
  const traceId = input.traceId ?? randomUUID();
  const payload: AgentTaskPayload = {
    run_id: input.run.id,
    step_id: input.step.id,
    goal: input.goal,
    trace_id: traceId,
    conversation_id: input.run.conversation_id ?? null,
    user_id: input.run.created_by_user_id ?? null,
    ...(input.personaOrgOverride
      ? { persona_org_override: input.personaOrgOverride }
      : {}),
    ...(input.personaWorkspaceOverride
      ? { persona_workspace_override: input.personaWorkspaceOverride }
      : {}),
    ...(input.grantsSnapshot ? { grants_snapshot: input.grantsSnapshot } : {}),
    ...(input.budgetSnapshot ? { budget_snapshot: input.budgetSnapshot } : {}),
    ...(input.packagesSnapshot ? { packages_snapshot: input.packagesSnapshot } : {}),
  };
  const message: BusMessage = {
    event_id: randomUUID(),
    correlation_id: traceId,
    causation_id: input.run.id,
    tenant_id: input.run.organization_id,
    workspace_id: input.run.workspace_id,
    run_id: input.run.id,
    timestamp: new Date().toISOString(),
    version: "1",
    event_type: "agent.task",
    payload: { ...payload },
  };
  await bus.publish(message, { topic: agentTasksTopic(input.agentId) });
  return traceId;
}
