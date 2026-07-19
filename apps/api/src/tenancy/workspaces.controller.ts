import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard.js";
import type { RequestWithAuth } from "../auth/auth.tokens.js";
import { RequireOrgRole, RequireWorkspaceMember } from "../rbac/rbac.decorators.js";
import { RbacGuard } from "../rbac/rbac.guard.js";
import { WorkspacesService } from "./workspaces.service.js";

type CreateWorkspaceBody = {
  name?: string;
  slug?: string;
};

@Controller()
@UseGuards(AuthGuard, RbacGuard)
export class WorkspacesController {
  constructor(@Inject(WorkspacesService) private readonly workspaces: WorkspacesService) {}

  @Post("organizations/:orgId/workspaces")
  @RequireOrgRole("EDITOR")
  create(
    @Req() req: RequestWithAuth,
    @Param("orgId") orgId: string,
    @Body() body: CreateWorkspaceBody,
  ) {
    return this.workspaces.create({
      organizationId: orgId,
      name: body.name ?? "",
      slug: body.slug ?? "",
      creatorUserId: req.verseAuth!.user.id,
    });
  }

  @Get("organizations/:orgId/workspaces")
  @RequireOrgRole("VIEWER")
  list(@Req() req: RequestWithAuth, @Param("orgId") orgId: string) {
    return this.workspaces.listForOrganization(orgId, req.verseAuth!.user.id);
  }

  @Get("workspaces/:workspaceId")
  @RequireWorkspaceMember("VIEWER")
  get(@Req() req: RequestWithAuth, @Param("workspaceId") workspaceId: string) {
    return this.workspaces.getById(workspaceId, req.verseAuth!.user.id);
  }
}
