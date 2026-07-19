import {
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Inject,
  NotFoundException,
  Post,
  Req,
} from "@nestjs/common";
import type { AuthProvider } from "@at72-verse/auth";
import { AuthError } from "@at72-verse/auth";
import { checkAuthRateLimit } from "../quotas/rate-limit.redis.js";
import { clientIp } from "../security/client-ip.js";
import { AUTH_PROVIDER, type RequestWithAuth } from "./auth.tokens.js";

type DevLoginBody = {
  email?: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  idpUserId?: string;
};

@Controller("auth")
export class AuthController {
  constructor(@Inject(AUTH_PROVIDER) private readonly authProvider: AuthProvider) {}

  /**
   * Dev-only session minting. Disabled when AUTH_PROVIDER=clerk.
   */
  @Post("dev/login")
  async devLogin(
    @Req() req: RequestWithAuth & { ip?: string },
    @Body() body: DevLoginBody,
  ) {
    if (this.authProvider.name !== "dev" || !this.authProvider.createDevSession) {
      throw new NotFoundException({
        code: "not_found",
        message: "Dev login is only available when AUTH_PROVIDER=dev",
      });
    }

    try {
      const rl = await checkAuthRateLimit("login", clientIp(req));
      if (!rl.allowed) {
        throw new HttpException(
          {
            code: "AUTH_RATE_LIMITED",
            message: "Authentication rate limit exceeded",
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

    try {
      const result = await this.authProvider.createDevSession({
        email: body.email ?? "",
        displayName: body.displayName,
        avatarUrl: body.avatarUrl,
        idpUserId: body.idpUserId,
      });
      return {
        accessToken: result.accessToken,
        tokenType: "Bearer",
        session: result.session,
      };
    } catch (err) {
      if (err instanceof AuthError) {
        throw new HttpException({ code: err.code, message: err.message }, err.statusCode);
      }
      throw err;
    }
  }

  @Post("logout")
  async logout(@Req() request: RequestWithAuth) {
    await this.authProvider.logout({ headers: request.headers });
    return { ok: true };
  }
}
