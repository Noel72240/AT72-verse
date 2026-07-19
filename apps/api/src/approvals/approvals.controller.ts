import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard.js";
import type { RequestWithAuth } from "../auth/auth.tokens.js";
import { RequireWorkspaceMember } from "../rbac/rbac.decorators.js";
import { RbacGuard } from "../rbac/rbac.guard.js";
import { ApprovalsService } from "./approvals.service.js";

type DecideBody = {
  approval_id?: string;
};

@Controller()
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Get("workspaces/:workspaceId/approvals")
  @UseGuards(AuthGuard, RbacGuard)
  @RequireWorkspaceMember("VIEWER")
  list(
    @Req() req: RequestWithAuth,
    @Param("workspaceId") workspaceId: string,
    @Query("status") status?: string,
  ) {
    return this.approvals.list(workspaceId, req.verseAuth!.user.id, status);
  }

  /** ADMIN|OWNER enforced in service via run.workspaceId (no workspace param). */
  @Post("runs/:runId/approve")
  @UseGuards(AuthGuard)
  approve(
    @Req() req: RequestWithAuth,
    @Param("runId") runId: string,
    @Body() body: DecideBody,
  ) {
    return this.approvals.approve(runId, req.verseAuth!.user.id, body.approval_id ?? "");
  }

  @Post("runs/:runId/reject")
  @UseGuards(AuthGuard)
  reject(
    @Req() req: RequestWithAuth,
    @Param("runId") runId: string,
    @Body() body: DecideBody,
  ) {
    return this.approvals.reject(runId, req.verseAuth!.user.id, body.approval_id ?? "");
  }
}
