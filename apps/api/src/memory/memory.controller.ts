import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard.js";
import type { RequestWithAuth } from "../auth/auth.tokens.js";
import { RequireWorkspaceMember } from "../rbac/rbac.decorators.js";
import { RbacGuard } from "../rbac/rbac.guard.js";
import { MemoryService } from "./memory.service.js";

@Controller()
@UseGuards(AuthGuard, RbacGuard)
export class MemoryController {
  constructor(private readonly memory: MemoryService) {}

  /** RBAC enforced in service (conversation → workspace membership). */
  @Get("conversations/:conversationId/memory")
  listConversation(
    @Req() req: RequestWithAuth,
    @Param("conversationId") conversationId: string,
    @Query("scope") scope?: string,
    @Query("limit") limit?: string,
  ) {
    return this.memory.listForConversation(conversationId, req.verseAuth!.user.id, {
      scope,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("workspaces/:workspaceId/memory")
  @RequireWorkspaceMember("VIEWER")
  listWorkspace(
    @Req() req: RequestWithAuth,
    @Param("workspaceId") workspaceId: string,
    @Query("scope") scope?: string,
    @Query("run_id") runId?: string,
    @Query("limit") limit?: string,
  ) {
    return this.memory.listForWorkspace(workspaceId, req.verseAuth!.user.id, {
      scope,
      runId,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Post("workspaces/:workspaceId/memory")
  @RequireWorkspaceMember("ADMIN")
  createBrand(
    @Req() req: RequestWithAuth,
    @Param("workspaceId") workspaceId: string,
    @Body() body: { scope?: string; content?: string; pinned?: boolean },
  ) {
    return this.memory.createBrandFact(workspaceId, req.verseAuth!.user.id, {
      scope: body.scope,
      content: body.content ?? "",
      pinned: body.pinned,
    });
  }

  @Post("workspaces/:workspaceId/memory/:memoryId/pin")
  @RequireWorkspaceMember("ADMIN")
  pin(
    @Req() req: RequestWithAuth,
    @Param("workspaceId") workspaceId: string,
    @Param("memoryId") memoryId: string,
  ) {
    return this.memory.pinRecord(workspaceId, req.verseAuth!.user.id, memoryId);
  }

  @Delete("workspaces/:workspaceId/memory/:memoryId")
  @RequireWorkspaceMember("ADMIN")
  forget(
    @Req() req: RequestWithAuth,
    @Param("workspaceId") workspaceId: string,
    @Param("memoryId") memoryId: string,
  ) {
    return this.memory.forgetRecord(workspaceId, req.verseAuth!.user.id, memoryId);
  }
}
