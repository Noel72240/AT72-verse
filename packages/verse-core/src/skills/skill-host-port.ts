/**
 * Host-provided skill execution port (Phase 14 / BB1).
 * Runtime registers skill packages; Core never imports skills/*.
 */
import type { KernelClient, SkillInvokeResult } from "@at72-verse/contracts";

export type SkillHostPort = {
  invoke(
    skillId: string,
    input: Record<string, unknown>,
    kernel: KernelClient,
  ): Promise<SkillInvokeResult>;
  resolve(skillId: string): Promise<{ id: string; version: string }>;
};
