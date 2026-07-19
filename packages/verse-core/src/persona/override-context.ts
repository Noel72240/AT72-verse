/**
 * Request-scoped persona override stamps (Phase 17).
 * Runtime fills from AgentTaskPayload; Core PersonaOverridePort reads here.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import type { PersonaSpecPatch } from "@at72-verse/contracts";
import type { PersonaOverridePort } from "./persona-engine.js";

export type PersonaOverrideStamp = {
  organization?: PersonaSpecPatch | null;
  workspace?: PersonaSpecPatch | null;
};

const als = new AsyncLocalStorage<PersonaOverrideStamp>();

export function runWithPersonaOverrides<T>(
  stamp: PersonaOverrideStamp,
  fn: () => Promise<T>,
): Promise<T> {
  return als.run(stamp, fn);
}

/** Current request-scoped stamp (Runtime orchestration / diagnostics). */
export function getPersonaOverrideStamp(): PersonaOverrideStamp | undefined {
  return als.getStore();
}

/** Override port that reads AsyncLocalStorage stamps (Runtime). */
export function createStampedPersonaOverridePort(): PersonaOverridePort {
  return {
    async load(_organizationId, _workspaceId, _agentId) {
      const stamp = als.getStore();
      return {
        organization: stamp?.organization ?? null,
        workspace: stamp?.workspace ?? null,
      };
    },
  };
}
