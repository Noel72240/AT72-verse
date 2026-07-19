import { Controller, Get, Inject, Param, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard.js";
import type { RequestWithAuth } from "../auth/auth.tokens.js";
import { RequireWorkspaceMember } from "../rbac/rbac.decorators.js";
import { RbacGuard } from "../rbac/rbac.guard.js";
import { ToolsService } from "./tools.service.js";

@Controller()
@UseGuards(AuthGuard, RbacGuard)
export class ToolsController {
  constructor(@Inject(ToolsService) private readonly tools: ToolsService) {}

  @Get("workspaces/:workspaceId/tool-executions")
  @RequireWorkspaceMember("VIEWER")
  listWorkspace(
    @Req() req: RequestWithAuth,
    @Param("workspaceId") workspaceId: string,
    @Query("run_id") runId?: string,
    @Query("tool_id") toolId?: string,
    @Query("limit") limit?: string,
  ) {
    return this.tools.listForWorkspace(workspaceId, req.verseAuth!.user.id, {
      runId,
      toolId,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get("runs/:runId/tool-executions")
  listRun(
    @Req() req: RequestWithAuth,
    @Param("runId") runId: string,
    @Query("limit") limit?: string,
  ) {
    return this.tools.listForRun(runId, req.verseAuth!.user.id, {
      limit: limit ? Number(limit) : undefined,
    });
  }
}
