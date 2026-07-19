import { Body, Controller, Param, Post, Req, UseGuards } from "@nestjs/common";
import type { OrgRole } from "@at72-verse/db";
import { AuthGuard } from "../auth/auth.guard.js";
import type { RequestWithAuth } from "../auth/auth.tokens.js";
import { RequireOrgRole } from "../rbac/rbac.decorators.js";
import { RbacGuard } from "../rbac/rbac.guard.js";
import { InvitationsService } from "./invitations.service.js";

type CreateInvitationBody = {
  email?: string;
  role?: OrgRole;
};

@Controller()
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Post("organizations/:orgId/invitations")
  @UseGuards(AuthGuard, RbacGuard)
  @RequireOrgRole("ADMIN")
  create(
    @Req() req: RequestWithAuth,
    @Param("orgId") orgId: string,
    @Body() body: CreateInvitationBody,
  ) {
    return this.invitations.create({
      organizationId: orgId,
      email: body.email ?? "",
      role: body.role,
      invitedById: req.verseAuth!.user.id,
    });
  }

  @Post("invitations/:token/accept")
  @UseGuards(AuthGuard)
  accept(@Req() req: RequestWithAuth, @Param("token") token: string) {
    return this.invitations.accept(token, req.verseAuth!.user.id, req.verseAuth!.user.email);
  }
}
