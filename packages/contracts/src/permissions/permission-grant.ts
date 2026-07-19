/**
 * Capability grants (Phase 20 / DN2).
 * Generic for agents, skills, and tools — extensible to Marketplace / OAuth later.
 */
import type { IsoDateTime, UlidOrUuid } from "../common/primitives.js";

export type CapabilityKind = "agent" | "skill" | "tool";

/**
 * Stable denial taxonomy for debug (Phase 20 contrainte).
 * Extensible — new codes do not break Kernel APIs.
 */
export type AuthzDenialReason =
  | "persona_missing_tool"
  | "agent_allowlist"
  | "workspace_grant_disabled"
  | "workspace_grant_missing"
  | "side_effect_requires_explicit_grant"
  | "agent_disabled"
  | "skill_disabled"
  | "capability_not_registered"
  | "grants_snapshot_missing";

export type AuthzDecision = {
  allowed: boolean;
  /** Empty when allowed; ordered, deterministic denial codes when refused. */
  reasons: AuthzDenialReason[];
  details?: Record<string, unknown>;
};

/** Persisted / API grant row. */
export type PermissionGrant = {
  id: UlidOrUuid;
  organization_id: UlidOrUuid;
  workspace_id: UlidOrUuid;
  kind: CapabilityKind;
  capability_id: string;
  enabled: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
};

/** Immutable snapshot stamped at Run / task start (DN8). */
export type CapabilityGrantSnapshot = {
  version: "1";
  organization_id: UlidOrUuid;
  workspace_id: UlidOrUuid;
  captured_at: IsoDateTime;
  grants: Array<{
    kind: CapabilityKind;
    capability_id: string;
    enabled: boolean;
  }>;
};

/** First-party default enablement (DN12). */
export const FIRST_PARTY_CAPABILITY_DEFAULTS: ReadonlyArray<{
  kind: CapabilityKind;
  capability_id: string;
  enabled: boolean;
}> = [
  { kind: "agent", capability_id: "adam", enabled: true },
  { kind: "agent", capability_id: "nova", enabled: true },
  { kind: "agent", capability_id: "orion", enabled: true },
  { kind: "agent", capability_id: "astra", enabled: true },
  { kind: "agent", capability_id: "pixel", enabled: true },
  { kind: "agent", capability_id: "pulse", enabled: true },
  { kind: "agent", capability_id: "echo", enabled: true },
  { kind: "skill", capability_id: "skill.writing", enabled: true },
  { kind: "skill", capability_id: "skill.analysis", enabled: true },
  { kind: "skill", capability_id: "skill.seo", enabled: true },
  { kind: "skill", capability_id: "skill.image-generation", enabled: true },
  { kind: "skill", capability_id: "skill.social-scheduling", enabled: true },
  { kind: "skill", capability_id: "skill.local-presence", enabled: true },
  { kind: "tool", capability_id: "web-search", enabled: true },
  { kind: "tool", capability_id: "file-read-write", enabled: false },
  { kind: "tool", capability_id: "seo-audit", enabled: true },
  { kind: "tool", capability_id: "image-generate", enabled: false },
  { kind: "tool", capability_id: "social-publish", enabled: true },
  { kind: "tool", capability_id: "gmb-sync", enabled: true },
] as const;
