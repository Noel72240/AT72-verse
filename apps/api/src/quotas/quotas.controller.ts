import { Body, Controller, Get, Inject, Param, Put, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard.js";
import type { RequestWithAuth } from "../auth/auth.tokens.js";
import { RequireOrgRole } from "../rbac/rbac.decorators.js";
import { RbacGuard } from "../rbac/rbac.guard.js";
import { QuotasService } from "./quotas.service.js";

type PutBody = {
  plan_id?: string;
  runs_per_month?: number | null;
  tokens_per_month?: number | null;
  max_agents_installed?: number | null;
  api_rpm?: number | null;
  reason?: string | null;
};

@Controller()
@UseGuards(AuthGuard, RbacGuard)
export class QuotasController {
  constructor(@Inject(QuotasService) private readonly quotas: QuotasService) {}

  @Get("organizations/:orgId/quotas")
  @RequireOrgRole("VIEWER")
  status(@Req() req: RequestWithAuth, @Param("orgId") orgId: string) {
    return this.quotas.getStatus(orgId, req.verseAuth!.user.id);
  }

  @Get("organizations/:orgId/quotas/audit")
  @RequireOrgRole("ADMIN")
  audit(@Req() req: RequestWithAuth, @Param("orgId") orgId: string) {
    return this.quotas.listAudit(orgId, req.verseAuth!.user.id);
  }

  @Put("organizations/:orgId/quotas")
  @RequireOrgRole("OWNER")
  put(
    @Req() req: RequestWithAuth,
    @Param("orgId") orgId: string,
    @Body() body: PutBody,
  ) {
    return this.quotas.putOverrides(orgId, req.verseAuth!.user.id, body);
  }
}
