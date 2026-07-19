/**
 * Permission Engine (Phase 20 / DN1 · DN9).
 * Deterministic authz — reasons always explicit for debug.
 */
import type {
  AuthzDecision,
  AuthzDenialReason,
  CapabilityGrantSnapshot,
  CapabilityKind,
} from "@at72-verse/contracts";
import { KernelError } from "@at72-verse/verse-kernel";

function findGrant(
  snapshot: CapabilityGrantSnapshot | null | undefined,
  kind: CapabilityKind,
  capabilityId: string,
): { enabled: boolean } | null {
  if (!snapshot) return null;
  const row = snapshot.grants.find((g) => g.kind === kind && g.capability_id === capabilityId);
  return row ? { enabled: row.enabled } : null;
}

function deny(reasons: AuthzDenialReason[], details?: Record<string, unknown>): AuthzDecision {
  return {
    allowed: false,
    reasons: [...reasons].sort(),
    ...(details ? { details } : {}),
  };
}

function allow(details?: Record<string, unknown>): AuthzDecision {
  return { allowed: true, reasons: [], ...(details ? { details } : {}) };
}

export class PermissionEngine {
  evaluateAgentRun(input: {
    agent_id: string;
    grants_snapshot?: CapabilityGrantSnapshot | null;
  }): AuthzDecision {
    if (!input.grants_snapshot) {
      return deny(["grants_snapshot_missing"], { agent_id: input.agent_id });
    }
    const grant = findGrant(input.grants_snapshot, "agent", input.agent_id);
    if (!grant) {
      return deny(["workspace_grant_missing"], {
        kind: "agent",
        capability_id: input.agent_id,
      });
    }
    if (!grant.enabled) {
      return deny(["agent_disabled"], { agent_id: input.agent_id });
    }
    return allow({ agent_id: input.agent_id });
  }

  evaluateSkillInvoke(input: {
    skill_id: string;
    grants_snapshot?: CapabilityGrantSnapshot | null;
  }): AuthzDecision {
    if (!input.grants_snapshot) {
      return deny(["grants_snapshot_missing"], { skill_id: input.skill_id });
    }
    const grant = findGrant(input.grants_snapshot, "skill", input.skill_id);
    if (!grant) {
      return deny(["workspace_grant_missing"], {
        kind: "skill",
        capability_id: input.skill_id,
      });
    }
    if (!grant.enabled) {
      return deny(["skill_disabled"], { skill_id: input.skill_id });
    }
    return allow({ skill_id: input.skill_id });
  }

  /**
   * Effective tool authz (DN4):
   * Persona ∩ Agent allowlist ∩ Workspace grant ∩ side-effect constraint.
   */
  evaluateToolExecute(input: {
    tool_id: string;
    side_effect: boolean;
    persona_tools: string[];
    agent_allowlist: string[];
    grants_snapshot?: CapabilityGrantSnapshot | null;
  }): AuthzDecision {
    const reasons: AuthzDenialReason[] = [];

    if (!input.persona_tools.includes(input.tool_id)) {
      reasons.push("persona_missing_tool");
    }
    if (!input.agent_allowlist.includes(input.tool_id)) {
      reasons.push("agent_allowlist");
    }

    if (!input.grants_snapshot) {
      reasons.push("grants_snapshot_missing");
      return deny(reasons, {
        tool_id: input.tool_id,
        side_effect: input.side_effect,
      });
    }

    const grant = findGrant(input.grants_snapshot, "tool", input.tool_id);
    if (!grant) {
      reasons.push("workspace_grant_missing");
      if (input.side_effect) {
        reasons.push("side_effect_requires_explicit_grant");
      }
    } else if (!grant.enabled) {
      reasons.push("workspace_grant_disabled");
      if (input.side_effect) {
        reasons.push("side_effect_requires_explicit_grant");
      }
    }

    if (reasons.length > 0) {
      return deny(reasons, {
        tool_id: input.tool_id,
        side_effect: input.side_effect,
        persona_tools: input.persona_tools,
        agent_allowlist: input.agent_allowlist,
      });
    }
    return allow({ tool_id: input.tool_id, side_effect: input.side_effect });
  }

  assertAllowed(decision: AuthzDecision, message: string): void {
    if (decision.allowed) return;
    throw new KernelError("FORBIDDEN", message, {
      details: {
        reasons: decision.reasons,
        ...(decision.details ?? {}),
      },
    });
  }
}

/** Build a deterministic snapshot from grant rows (sorted). */
export function buildCapabilityGrantSnapshot(input: {
  organization_id: string;
  workspace_id: string;
  grants: Array<{ kind: CapabilityKind; capability_id: string; enabled: boolean }>;
  captured_at?: string;
}): CapabilityGrantSnapshot {
  const grants = [...input.grants]
    .map((g) => ({
      kind: g.kind,
      capability_id: g.capability_id,
      enabled: g.enabled,
    }))
    .sort((a, b) => {
      const k = a.kind.localeCompare(b.kind);
      return k !== 0 ? k : a.capability_id.localeCompare(b.capability_id);
    });
  return {
    version: "1",
    organization_id: input.organization_id,
    workspace_id: input.workspace_id,
    captured_at: input.captured_at ?? new Date().toISOString(),
    grants,
  };
}
