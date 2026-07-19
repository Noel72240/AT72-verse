import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { CapabilityKind, PermissionGrant } from "@at72-verse/contracts";
import {
  ensureFirstPartyCapabilityGrants,
  listCapabilityGrants,
  upsertCapabilityGrant,
  type PrismaClient,
} from "@at72-verse/db";
import { buildCapabilityGrantSnapshot } from "@at72-verse/verse-core";
import { PRISMA } from "../auth/auth.tokens.js";
import { RbacService } from "../rbac/rbac.service.js";

const KINDS = new Set<CapabilityKind>(["agent", "skill", "tool"]);

@Injectable()
export class GrantsService {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    private readonly rbac: RbacService,
  ) {}

  async list(workspaceId: string, userId: string): Promise<{ grants: PermissionGrant[] }> {
    const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!ws) {
      throw new NotFoundException({ code: "not_found", message: "Workspace not found" });
    }
    await this.rbac.requireWorkspaceMember(userId, workspaceId, "VIEWER");
    const grants = await ensureFirstPartyCapabilityGrants(
      this.prisma,
      ws.organizationId,
      workspaceId,
    );
    return { grants };
  }

  async setEnabled(
    workspaceId: string,
    userId: string,
    input: {
      kind: string;
      capability_id: string;
      enabled: boolean;
      require_approval?: boolean;
    },
  ): Promise<{ grant: PermissionGrant }> {
    const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!ws) {
      throw new NotFoundException({ code: "not_found", message: "Workspace not found" });
    }
    await this.rbac.requireWorkspaceMember(userId, workspaceId, "EDITOR");
    if (!KINDS.has(input.kind as CapabilityKind)) {
      throw new BadRequestException({
        code: "invalid_input",
        message: "kind must be agent|skill|tool",
      });
    }
    if (!input.capability_id?.trim()) {
      throw new BadRequestException({
        code: "invalid_input",
        message: "capability_id required",
      });
    }
    await ensureFirstPartyCapabilityGrants(this.prisma, ws.organizationId, workspaceId);
    const grant = await upsertCapabilityGrant(this.prisma, {
      organization_id: ws.organizationId,
      workspace_id: workspaceId,
      kind: input.kind as CapabilityKind,
      capability_id: input.capability_id.trim(),
      enabled: Boolean(input.enabled),
      ...(input.require_approval !== undefined
        ? { require_approval: Boolean(input.require_approval) }
        : {}),
    });
    return { grant };
  }

  /** Build frozen snapshot for run dispatch (DN8). */
  async snapshotForWorkspace(organizationId: string, workspaceId: string) {
    const grants = await ensureFirstPartyCapabilityGrants(
      this.prisma,
      organizationId,
      workspaceId,
    );
    return buildCapabilityGrantSnapshot({
      organization_id: organizationId,
      workspace_id: workspaceId,
      grants: grants.map((g) => ({
        kind: g.kind,
        capability_id: g.capability_id,
        enabled: g.enabled,
        require_approval: g.require_approval,
      })),
    });
  }

  async assertAgentEnabled(
    organizationId: string,
    workspaceId: string,
    agentId: string,
  ): Promise<ReturnType<typeof buildCapabilityGrantSnapshot>> {
    const snapshot = await this.snapshotForWorkspace(organizationId, workspaceId);
    const row = snapshot.grants.find((g) => g.kind === "agent" && g.capability_id === agentId);
    if (!row || !row.enabled) {
      throw new BadRequestException({
        code: "agent_disabled",
        message: `Agent disabled for workspace: ${agentId}`,
        reasons: row ? ["agent_disabled"] : ["workspace_grant_missing"],
      });
    }
    return snapshot;
  }
}
