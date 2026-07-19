import { Body, Controller, Get, Inject, Param, Put, Req, UseGuards } from "@nestjs/common";
import type { PersonaSpecPatch } from "@at72-verse/contracts";
import { AuthGuard } from "../auth/auth.guard.js";
import type { RequestWithAuth } from "../auth/auth.tokens.js";
import { RequireOrgRole, RequireWorkspaceMember } from "../rbac/rbac.decorators.js";
import { RbacGuard } from "../rbac/rbac.guard.js";
import { PersonaService } from "./persona.service.js";

type PatchBody = {
  patch?: PersonaSpecPatch;
};

@Controller()
@UseGuards(AuthGuard, RbacGuard)
export class PersonaController {
  constructor(@Inject(PersonaService) private readonly personas: PersonaService) {}

  @Get("workspaces/:workspaceId/personas/:agentId")
  @RequireWorkspaceMember("VIEWER")
  previewWorkspace(
    @Req() req: RequestWithAuth,
    @Param("workspaceId") workspaceId: string,
    @Param("agentId") agentId: string,
  ) {
    return this.personas.previewResolved(workspaceId, agentId, req.verseAuth!.user.id);
  }

  @Put("workspaces/:workspaceId/personas/:agentId")
  @RequireWorkspaceMember("EDITOR")
  upsertWorkspace(
    @Req() req: RequestWithAuth,
    @Param("workspaceId") workspaceId: string,
    @Param("agentId") agentId: string,
    @Body() body: PatchBody,
  ) {
    return this.personas.upsertWorkspaceOverride(
      workspaceId,
      agentId,
      req.verseAuth!.user.id,
      body.patch ?? {},
    );
  }

  @Get("organizations/:orgId/personas/:agentId")
  @RequireOrgRole("VIEWER")
  getOrg(
    @Req() req: RequestWithAuth,
    @Param("orgId") orgId: string,
    @Param("agentId") agentId: string,
  ) {
    return this.personas.getOrgPersonaOrPreview(orgId, agentId, req.verseAuth!.user.id);
  }

  @Put("organizations/:orgId/personas/:agentId")
  @RequireOrgRole("EDITOR")
  upsertOrg(
    @Req() req: RequestWithAuth,
    @Param("orgId") orgId: string,
    @Param("agentId") agentId: string,
    @Body() body: PatchBody,
  ) {
    return this.personas.upsertOrgOverride(
      orgId,
      agentId,
      req.verseAuth!.user.id,
      body.patch ?? {},
    );
  }
}
