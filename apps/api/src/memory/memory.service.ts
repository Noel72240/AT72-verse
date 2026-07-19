import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import type { MemoryRecord } from "@at72-verse/contracts";
import {
  createPrismaMemoryStore,
  createPrismaVectorIndex,
  type PrismaClient,
} from "@at72-verse/db";
import type { VerseCore } from "@at72-verse/verse-core";
import { PRISMA } from "../auth/auth.tokens.js";
import { VERSE_CORE } from "../core/core.tokens.js";
import { RbacService } from "../rbac/rbac.service.js";

function rowToContract(row: {
  id: string;
  organizationId: string;
  workspaceId: string;
  runId: string | null;
  conversationId: string | null;
  userId: string | null;
  agentId: string | null;
  traceId: string | null;
  scope: string;
  layer: string;
  type: string;
  content: string;
  pinned: boolean;
  deletedAt: Date | null;
  createdAt: Date;
}): MemoryRecord {
  return {
    id: row.id,
    organization_id: row.organizationId,
    workspace_id: row.workspaceId,
    run_id: row.runId,
    conversation_id: row.conversationId,
    user_id: row.userId,
    agent_id: row.agentId,
    trace_id: row.traceId,
    scope: row.scope,
    layer: row.layer as MemoryRecord["layer"],
    type: row.type as MemoryRecord["type"],
    content: row.content,
    created_at: row.createdAt.toISOString(),
    pinned: row.pinned,
    deleted_at: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

@Injectable()
export class MemoryService implements OnModuleInit {
  constructor(
    @Inject(PRISMA) private readonly prisma: PrismaClient,
    @Inject(VERSE_CORE) private readonly core: VerseCore,
    private readonly rbac: RbacService,
  ) {}

  onModuleInit(): void {
    this.core.setMemoryStore(createPrismaMemoryStore(this.prisma));
    this.core.setVectorIndex(createPrismaVectorIndex(this.prisma));
  }

  async listForConversation(
    conversationId: string,
    userId: string,
    opts?: { scope?: string; limit?: number },
  ): Promise<{ records: MemoryRecord[] }> {
    const conversation = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
    });
    if (!conversation) {
      throw new NotFoundException({ code: "not_found", message: "Conversation not found" });
    }
    await this.rbac.requireWorkspaceMember(userId, conversation.workspaceId, "VIEWER");

    const limit = Math.min(opts?.limit ?? 50, 200);
    const rows = await this.prisma.memoryRecordRow.findMany({
      where: {
        organizationId: conversation.organizationId,
        conversationId,
        deletedAt: null,
        ...(opts?.scope ? { scope: opts.scope } : {}),
      },
      orderBy: [{ pinned: "desc" }, { createdAt: "asc" }, { id: "asc" }],
      take: limit,
    });

    return { records: rows.map(rowToContract) };
  }

  async listForWorkspace(
    workspaceId: string,
    userId: string,
    opts?: { scope?: string; runId?: string; limit?: number },
  ): Promise<{ records: MemoryRecord[] }> {
    const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!ws) {
      throw new NotFoundException({ code: "not_found", message: "Workspace not found" });
    }
    await this.rbac.requireWorkspaceMember(userId, workspaceId, "VIEWER");

    const limit = Math.min(opts?.limit ?? 50, 200);
    const rows = await this.prisma.memoryRecordRow.findMany({
      where: {
        organizationId: ws.organizationId,
        workspaceId,
        deletedAt: null,
        ...(opts?.scope ? { scope: opts.scope } : {}),
        ...(opts?.runId ? { runId: opts.runId } : {}),
      },
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }, { id: "asc" }],
      take: limit,
    });

    return { records: rows.map(rowToContract) };
  }

  /** Admin CRUD — create org.brand / org.content fact (Phase 25 / DS8). */
  async createBrandFact(
    workspaceId: string,
    userId: string,
    input: { scope?: string; content: string; pinned?: boolean },
  ): Promise<{ record: MemoryRecord }> {
    const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!ws) {
      throw new NotFoundException({ code: "not_found", message: "Workspace not found" });
    }
    await this.rbac.requireWorkspaceMember(userId, workspaceId, "ADMIN");
    const scope = input.scope ?? "org.brand";
    if (!scope.startsWith("org.")) {
      throw new BadRequestException({ code: "invalid_input", message: "scope must be org.*" });
    }
    const content = input.content?.trim();
    if (!content) {
      throw new BadRequestException({ code: "invalid_input", message: "content required" });
    }
    const record = await this.core.getMemoryGateway().adminRemember({
      organization_id: ws.organizationId,
      workspace_id: workspaceId,
      scope,
      content,
      type: "factual",
      pinned: input.pinned === true,
    });
    return { record };
  }

  async pinRecord(
    workspaceId: string,
    userId: string,
    memoryId: string,
  ): Promise<{ record: MemoryRecord }> {
    const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!ws) {
      throw new NotFoundException({ code: "not_found", message: "Workspace not found" });
    }
    await this.rbac.requireWorkspaceMember(userId, workspaceId, "ADMIN");
    const record = await this.core.getMemoryGateway().adminPin(memoryId, ws.organizationId);
    return { record };
  }

  async forgetRecord(workspaceId: string, userId: string, memoryId: string): Promise<{ ok: true }> {
    const ws = await this.prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!ws) {
      throw new NotFoundException({ code: "not_found", message: "Workspace not found" });
    }
    await this.rbac.requireWorkspaceMember(userId, workspaceId, "ADMIN");
    await this.core.getMemoryGateway().adminForget(memoryId, ws.organizationId);
    return { ok: true };
  }
}
