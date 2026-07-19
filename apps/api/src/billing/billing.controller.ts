import { Body, Controller, Get, Inject, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard.js";
import type { RequestWithAuth } from "../auth/auth.tokens.js";
import { RequireOrgRole } from "../rbac/rbac.decorators.js";
import { RbacGuard } from "../rbac/rbac.guard.js";
import { BillingService } from "./billing.service.js";

type CheckoutBody = {
  target_plan?: "pro" | "enterprise";
  success_url?: string;
  cancel_url?: string;
};

type ManageBody = {
  return_url?: string;
};

@Controller()
@UseGuards(AuthGuard, RbacGuard)
export class BillingController {
  constructor(@Inject(BillingService) private readonly billing: BillingService) {}

  @Get("organizations/:orgId/billing")
  @RequireOrgRole("ADMIN")
  status(@Req() req: RequestWithAuth, @Param("orgId") orgId: string) {
    return this.billing.getStatus(orgId, req.verseAuth!.user.id);
  }

  @Post("organizations/:orgId/billing/checkout")
  @RequireOrgRole("OWNER")
  checkout(
    @Req() req: RequestWithAuth,
    @Param("orgId") orgId: string,
    @Body() body: CheckoutBody,
  ) {
    const plan = body.target_plan === "enterprise" ? "enterprise" : "pro";
    const web =
      process.env.WEB_ORIGIN ?? process.env.NEXT_PUBLIC_WEB_ORIGIN ?? "http://localhost:3000";
    return this.billing.startCheckout(orgId, req.verseAuth!.user.id, plan, {
      success_url: body.success_url ?? `${web}/billing?success=1`,
      cancel_url: body.cancel_url ?? `${web}/billing?canceled=1`,
    });
  }

  @Post("organizations/:orgId/billing/portal")
  @RequireOrgRole("OWNER")
  portal(@Req() req: RequestWithAuth, @Param("orgId") orgId: string, @Body() body: ManageBody) {
    const web =
      process.env.WEB_ORIGIN ?? process.env.NEXT_PUBLIC_WEB_ORIGIN ?? "http://localhost:3000";
    return this.billing.openManage(
      orgId,
      req.verseAuth!.user.id,
      body.return_url ?? `${web}/billing`,
    );
  }

  @Post("organizations/:orgId/billing/cancel")
  @RequireOrgRole("OWNER")
  cancel(@Req() req: RequestWithAuth, @Param("orgId") orgId: string) {
    return this.billing.cancel(orgId, req.verseAuth!.user.id);
  }

  @Get("organizations/:orgId/billing/invoices")
  @RequireOrgRole("OWNER")
  invoices(@Req() req: RequestWithAuth, @Param("orgId") orgId: string) {
    return this.billing.listInvoices(orgId, req.verseAuth!.user.id);
  }
}
