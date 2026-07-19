import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Inject,
  Param,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import type { OrgRole } from "@at72-verse/db";
import { AuthGuard } from "../auth/auth.guard.js";
import type { RequestWithAuth } from "../auth/auth.tokens.js";
import { checkAuthRateLimit } from "../quotas/rate-limit.redis.js";
import { RequireOrgRole } from "../rbac/rbac.decorators.js";
import { RbacGuard } from "../rbac/rbac.guard.js";
import { clientIp } from "../security/client-ip.js";
import { InvitationsService } from "./invitations.service.js";

type CreateInvitationBody = {
  email?: string;
  role?: OrgRole;
};

@Controller()
export class InvitationsController {
  constructor(@Inject(InvitationsService) private readonly invitations: InvitationsService) {}

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
  async accept(@Req() req: RequestWithAuth & { ip?: string }, @Param("token") token: string) {
    try {
      const rl = await checkAuthRateLimit("invite", clientIp(req));
      if (!rl.allowed) {
        throw new HttpException(
          {
            code: "AUTH_RATE_LIMITED",
            message: "Invitation accept rate limit exceeded",
            limit: rl.limit,
            reset_at: rl.reset_at,
            retry_after: rl.retry_after_sec,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        { code: "unavailable", message: "Rate limiter unavailable" },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return this.invitations.accept(token, req.verseAuth!.user.id, req.verseAuth!.user.email);
  }
}
