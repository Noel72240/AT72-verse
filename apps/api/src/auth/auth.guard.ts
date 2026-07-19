import { Injectable, UnauthorizedException, Inject, GoneException } from "@nestjs/common";
import type { CanActivate, ExecutionContext } from "@nestjs/common";
import type { AuthProvider } from "@at72-verse/auth";
import type { PrismaClient } from "@at72-verse/db";
import { ensureVerseUser } from "../identity/ensure-verse-user.js";
import { AUTH_PROVIDER, PRISMA, type RequestWithAuth } from "./auth.tokens.js";

function isRestorePath(method: string, url: string): boolean {
  if (method !== "POST") return false;
  const path = url.split("?")[0] ?? "";
  return path.endsWith("/me/restore") || /\/organizations\/[^/]+\/restore$/.test(path);
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(AUTH_PROVIDER) private readonly authProvider: AuthProvider,
    @Inject(PRISMA) private readonly prisma: PrismaClient,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const session = await this.authProvider.authenticateRequest({
      headers: request.headers,
    });
    if (!session) {
      throw new UnauthorizedException({
        code: "unauthorized",
        message: "Authentication required",
      });
    }

    const user = await ensureVerseUser(this.prisma, session);
    const reqAny = request as RequestWithAuth & { method?: string; url?: string; path?: string };
    if (user.deletedAt && !isRestorePath(reqAny.method ?? "GET", reqAny.url ?? reqAny.path ?? "")) {
      throw new GoneException({
        code: "gone",
        message: "User has been soft-deleted",
      });
    }
    request.verseAuth = { session, user };
    return true;
  }
}
