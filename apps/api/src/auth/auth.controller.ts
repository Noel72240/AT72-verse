import {
  Body,
  Controller,
  HttpException,
  Inject,
  NotFoundException,
  Post,
  Req,
} from "@nestjs/common";
import type { AuthProvider } from "@at72-verse/auth";
import { AuthError } from "@at72-verse/auth";
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
  async devLogin(@Body() body: DevLoginBody) {
    if (this.authProvider.name !== "dev" || !this.authProvider.createDevSession) {
      throw new NotFoundException({
        code: "not_found",
        message: "Dev login is only available when AUTH_PROVIDER=dev",
      });
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
