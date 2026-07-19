/**
 * Prisma-backed PersonaOverridePort (Phase 17 / ADR-010).
 * Used by API preview + Core resolve when host is Nest — Runtime uses stamped port instead.
 */
import type { PersonaSpecPatch } from "@at72-verse/contracts";
import type { PrismaClient } from "@at72-verse/db";
import type { PersonaOverridePort } from "@at72-verse/verse-core";

export function createPrismaPersonaOverridePort(prisma: PrismaClient): PersonaOverridePort {
  return {
    async load(organizationId, workspaceId, agentId) {
      const orgRow = await prisma.personaOverride.findFirst({
        where: { organizationId, workspaceId: null, agentId },
      });
      const wsRow =
        workspaceId.length > 0
          ? await prisma.personaOverride.findFirst({
              where: { organizationId, workspaceId, agentId },
            })
          : null;
      return {
        organization: (orgRow?.patch as PersonaSpecPatch | null) ?? null,
        workspace: (wsRow?.patch as PersonaSpecPatch | null) ?? null,
      };
    },
  };
}
