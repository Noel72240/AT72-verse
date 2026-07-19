import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard.js";
import type { RequestWithAuth } from "../auth/auth.tokens.js";

@Controller()
export class MeController {
  @Get("me")
  @UseGuards(AuthGuard)
  me(@Req() request: RequestWithAuth) {
    const ctx = request.verseAuth;
    if (!ctx) {
      return null;
    }
    return {
      user: {
        id: ctx.user.id,
        email: ctx.user.email,
        displayName: ctx.user.displayName,
        avatarUrl: ctx.user.avatarUrl,
        clerkUserId: ctx.user.clerkUserId,
      },
      session: {
        provider: ctx.session.provider,
        sessionId: ctx.session.sessionId,
        idpUserId: ctx.session.idpUserId,
      },
    };
  }
}
