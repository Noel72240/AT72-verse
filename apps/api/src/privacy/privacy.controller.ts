import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard.js";
import type { RequestWithAuth } from "../auth/auth.tokens.js";
import { RequireOrgRole } from "../rbac/rbac.decorators.js";
import { RbacGuard } from "../rbac/rbac.guard.js";
import { PrivacyService } from "./privacy.service.js";

@Controller()
@UseGuards(AuthGuard, RbacGuard)
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Post("me/export")
  exportMe(@Req() req: RequestWithAuth) {
    return this.privacy.requestUserExport(req.verseAuth!.user.id);
  }

  @Get("me/export/:jobId")
  getMyExport(@Req() req: RequestWithAuth, @Param("jobId") jobId: string) {
    return this.privacy.getExport(jobId, req.verseAuth!.user.id);
  }

  @Post("me/soft-delete")
  softDeleteMe(@Req() req: RequestWithAuth) {
    return this.privacy.softDeleteMe(req.verseAuth!.user.id);
  }

  @Post("me/restore")
  restoreMe(@Req() req: RequestWithAuth) {
    return this.privacy.restoreMe(req.verseAuth!.user.id);
  }

  @Post("organizations/:orgId/export")
  @RequireOrgRole("OWNER")
  exportOrg(@Req() req: RequestWithAuth, @Param("orgId") orgId: string) {
    return this.privacy.requestOrgExport(orgId, req.verseAuth!.user.id);
  }

  @Post("organizations/:orgId/soft-delete")
  @RequireOrgRole("OWNER")
  softDeleteOrg(@Req() req: RequestWithAuth, @Param("orgId") orgId: string) {
    return this.privacy.softDeleteOrg(orgId, req.verseAuth!.user.id);
  }

  @Post("organizations/:orgId/restore")
  restoreOrg(@Req() req: RequestWithAuth, @Param("orgId") orgId: string) {
    return this.privacy.restoreOrg(orgId, req.verseAuth!.user.id);
  }

  @Get("organizations/:orgId/audit-events")
  @RequireOrgRole("ADMIN")
  auditEvents(@Req() req: RequestWithAuth, @Param("orgId") orgId: string) {
    return this.privacy.listAudit(orgId, req.verseAuth!.user.id);
  }

  @Put("organizations/:orgId/retention")
  @RequireOrgRole("OWNER")
  retention(
    @Req() req: RequestWithAuth,
    @Param("orgId") orgId: string,
    @Body()
    body: { soft_delete_grace_days?: number; audit_retention_days?: number },
  ) {
    return this.privacy.updateRetention(orgId, req.verseAuth!.user.id, body);
  }
}
