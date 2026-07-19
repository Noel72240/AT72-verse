import { Body, Controller, Get, Param, Put, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard.js";
import type { RequestWithAuth } from "../auth/auth.tokens.js";
import { RequireWorkspaceMember } from "../rbac/rbac.decorators.js";
import { RbacGuard } from "../rbac/rbac.guard.js";
import { GrantsService } from "./grants.service.js";

type SetBody = {
  kind?: string;
  capability_id?: string;
  enabled?: boolean;
};

@Controller()
@UseGuards(AuthGuard, RbacGuard)
export class GrantsController {
  constructor(private readonly grants: GrantsService) {}

  @Get("workspaces/:workspaceId/grants")
  @RequireWorkspaceMember("VIEWER")
  list(@Req() req: RequestWithAuth, @Param("workspaceId") workspaceId: string) {
    return this.grants.list(workspaceId, req.verseAuth!.user.id);
  }

  @Put("workspaces/:workspaceId/grants")
  @RequireWorkspaceMember("EDITOR")
  set(
    @Req() req: RequestWithAuth,
    @Param("workspaceId") workspaceId: string,
    @Body() body: SetBody,
  ) {
    return this.grants.setEnabled(workspaceId, req.verseAuth!.user.id, {
      kind: body.kind ?? "",
      capability_id: body.capability_id ?? "",
      enabled: Boolean(body.enabled),
    });
  }
}
