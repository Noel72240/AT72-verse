import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import type { PersonaSpecPatch, ResolvedPersona } from "@at72-verse/contracts";
import type { PrismaClient, Prisma } from "@at72-verse/db";
import { mergePersonaLayers, type VerseCore } from "@at72-verse/verse-core";
import { PRISMA } from "../auth/auth.tokens.js";
import { VERSE_CORE } from "../core/core.tokens.js";
import { RbacService } from "../rbac/rbac.service.js";
import { createPrismaPersonaOverridePort } from "./prisma-persona-override-port.js";

function asPatch(value: unknown): PersonaSpecPatch {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadRequestException({
      code: "invalid_input",
      message: "patch must be an object",
    });
  }
  return value as PersonaSpecPatch;
}

@Injectable()
export class PersonaService implements OnModuleInit {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(VERSE_CORE) private readonly core: VerseCore,
    @Inject(RbacService) private readonly rbac: RbacService,
  ) {}

  onModuleInit(): void {
    this.core.setPersonaOverrides(createPrismaPersonaOverridePort(this.prisma));
  }

  async loadOverridesForAgent(
    organizationId: string,
    workspaceId: string,
    agentId: string,
  ): Promise<{
    organization?: PersonaSpecPatch;
    workspace?: PersonaSpecPatch;
  }> {
    const port = createPrismaPersonaOverridePort(this.prisma);
    const loaded = await port.load(organizationId, workspaceId, agentId);
    return {
      ...(loaded.organization ? { organization: loaded.organization } : {}),
      ...(loaded.workspace ? { workspace: loaded.workspace } : {}),
    };
  }

  async getOrgOverride(orgId: string, agentId: string, userId: string) {
    await this.rbac.requireOrgRole(userId, orgId, "VIEWER");
    const row = await this.prisma.personaOverride.findFirst({
      where: { organizationId: orgId, workspaceId: null, agentId },
    });
    if (!row) {
      return null;
    }
    return {
      organization_id: row.organizationId,
      workspace_id: null as string | null,
      agent_id: row.agentId,
      patch: row.patch as PersonaSpecPatch,
      updated_at: row.updatedAt.toISOString(),
    };
  }

  async upsertOrgOverride(
    orgId: string,
    agentId: string,
    userId: string,
    patch: PersonaSpecPatch,
  ) {
    await this.rbac.requireOrgRole(userId, orgId, "EDITOR");
    const normalized = asPatch(patch);
    const existing = await this.prisma.personaOverride.findFirst({
      where: { organizationId: orgId, workspaceId: null, agentId },
    });
    const row = existing
      ? await this.prisma.personaOverride.update({
          where: { id: existing.id },
          data: { patch: normalized as Prisma.InputJsonValue },
        })
      : await this.prisma.personaOverride.create({
          data: {
            organizationId: orgId,
            workspaceId: null,
            agentId,
            patch: normalized as Prisma.InputJsonValue,
          },
        });
    return {
      organization_id: row.organizationId,
      workspace_id: null as string | null,
      agent_id: row.agentId,
      patch: row.patch as PersonaSpecPatch,
      updated_at: row.updatedAt.toISOString(),
    };
  }

  async getWorkspaceOverride(workspaceId: string, agentId: string, userId: string) {
    await this.rbac.requireWorkspaceMember(userId, workspaceId, "VIEWER");
    const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!ws) {
      throw new NotFoundException({ code: "not_found", message: "Workspace not found" });
    }
    const row = await this.prisma.personaOverride.findFirst({
      where: {
        organizationId: ws.organizationId,
        workspaceId,
        agentId,
      },
    });
    if (!row) {
      return null;
    }
    return {
      organization_id: row.organizationId,
      workspace_id: row.workspaceId,
      agent_id: row.agentId,
      patch: row.patch as PersonaSpecPatch,
      updated_at: row.updatedAt.toISOString(),
    };
  }

  async upsertWorkspaceOverride(
    workspaceId: string,
    agentId: string,
    userId: string,
    patch: PersonaSpecPatch,
  ) {
    await this.rbac.requireWorkspaceMember(userId, workspaceId, "EDITOR");
    const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!ws) {
      throw new NotFoundException({ code: "not_found", message: "Workspace not found" });
    }
    const normalized = asPatch(patch);
    const existing = await this.prisma.personaOverride.findFirst({
      where: {
        organizationId: ws.organizationId,
        workspaceId,
        agentId,
      },
    });
    const row = existing
      ? await this.prisma.personaOverride.update({
          where: { id: existing.id },
          data: { patch: normalized as Prisma.InputJsonValue },
        })
      : await this.prisma.personaOverride.create({
          data: {
            organizationId: ws.organizationId,
            workspaceId,
            agentId,
            patch: normalized as Prisma.InputJsonValue,
          },
        });
    return {
      organization_id: row.organizationId,
      workspace_id: row.workspaceId,
      agent_id: row.agentId,
      patch: row.patch as PersonaSpecPatch,
      updated_at: row.updatedAt.toISOString(),
    };
  }

  /**
   * Preview merged ResolvedPersona for a workspace (org + workspace overrides).
   */
  async previewResolved(
    workspaceId: string,
    agentId: string,
    userId: string,
  ): Promise<ResolvedPersona> {
    await this.rbac.requireWorkspaceMember(userId, workspaceId, "VIEWER");
    const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!ws) {
      throw new NotFoundException({ code: "not_found", message: "Workspace not found" });
    }
    return this.core
      .getPersonaEngine()
      .resolve(agentId, ws.organizationId, workspaceId);
  }

  /**
   * Org-level GET: return stored override if any, else preview with org patch only.
   */
  async getOrgPersonaOrPreview(
    orgId: string,
    agentId: string,
    userId: string,
  ): Promise<
    | {
        kind: "override";
        organization_id: string;
        workspace_id: null;
        agent_id: string;
        patch: PersonaSpecPatch;
        updated_at: string;
      }
    | { kind: "resolved"; resolved: ResolvedPersona }
  > {
    const override = await this.getOrgOverride(orgId, agentId, userId);
    if (override) {
      return {
        kind: "override",
        organization_id: override.organization_id,
        workspace_id: null,
        agent_id: override.agent_id,
        patch: override.patch,
        updated_at: override.updated_at,
      };
    }
    const seed = this.core.getPersonaEngine().getSeed(agentId);
    if (!seed) {
      throw new NotFoundException({
        code: "not_found",
        message: `No first-party persona for agent: ${agentId}`,
      });
    }
    const orgRow = await this.prisma.personaOverride.findFirst({
      where: { organizationId: orgId, workspaceId: null, agentId },
    });
    const resolved = mergePersonaLayers({
      agentId,
      agentPersona: seed,
      organization: (orgRow?.patch as PersonaSpecPatch | null) ?? null,
      workspace: null,
    });
    return { kind: "resolved", resolved };
  }
}