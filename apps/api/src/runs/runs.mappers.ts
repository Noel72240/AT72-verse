import type {
  Conversation as ContractConversation,
  Message as ContractMessage,
  Run as ContractRun,
  RunStep as ContractRunStep,
} from "@at72-verse/contracts";
import type { Conversation, Message, Run, RunStep } from "@at72-verse/db";

function iso(d: Date): string {
  return d.toISOString();
}

export function toContractConversation(row: Conversation): ContractConversation {
  return {
    id: row.id,
    organization_id: row.organizationId,
    workspace_id: row.workspaceId,
    created_by_user_id: row.createdByUserId,
    title: row.title,
    created_at: iso(row.createdAt),
    updated_at: iso(row.updatedAt),
  };
}

export function toContractMessage(row: Message): ContractMessage {
  return {
    id: row.id,
    organization_id: row.organizationId,
    conversation_id: row.conversationId,
    role: row.role,
    content: row.content,
    created_at: iso(row.createdAt),
  };
}

export function toContractRun(row: Run): ContractRun {
  return {
    id: row.id,
    organization_id: row.organizationId,
    workspace_id: row.workspaceId,
    conversation_id: row.conversationId,
    created_by_user_id: row.createdByUserId,
    status: row.status,
    created_at: iso(row.createdAt),
    updated_at: iso(row.updatedAt),
    started_at: row.startedAt ? iso(row.startedAt) : null,
    completed_at: row.completedAt ? iso(row.completedAt) : null,
    error: (row.error as Record<string, unknown> | null) ?? null,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
  };
}

export function toContractRunStep(row: RunStep): ContractRunStep {
  return {
    id: row.id,
    organization_id: row.organizationId,
    run_id: row.runId,
    parent_step_id: row.parentStepId,
    seq: row.seq,
    name: row.name,
    kind: row.kind,
    agent_id: row.agentId,
    status: row.status,
    input: (row.input as Record<string, unknown> | null) ?? null,
    output: (row.output as Record<string, unknown> | null) ?? null,
    created_at: iso(row.createdAt),
    updated_at: iso(row.updatedAt),
  };
}
