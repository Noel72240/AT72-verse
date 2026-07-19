/**
 * Skill plugin contracts (Phase 14 / BA2 · BC1 · ADR-011).
 * Skills depend on this surface + KernelClient only — never agents or Core.
 */
import type { KernelClient } from "../kernel/kernel-api.js";
import type { SkillSpec } from "./skill-spec.js";

export type SkillExecuteContext = {
  kernel: KernelClient;
  input: Record<string, unknown>;
};

/**
 * Minimal skill module surface (BC1).
 * Packages export `SKILL_ID`, `skillSpec` (or alias), and `execute`.
 */
export type SkillModule = {
  id: string;
  spec: SkillSpec;
  execute: (ctx: SkillExecuteContext) => Promise<Record<string, unknown>>;
};

/** Host-side skill registry entry (Runtime — BB1). Not used inside skill packages. */
export type SkillPlugin = {
  id: string;
  version: string;
  spec: SkillSpec;
  execute: (ctx: SkillExecuteContext) => Promise<Record<string, unknown>>;
};
