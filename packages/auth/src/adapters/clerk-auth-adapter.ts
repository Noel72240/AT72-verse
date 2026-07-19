import { createClerkClient, verifyToken } from "@clerk/backend";
import type { AuthProvider } from "../ports/auth-provider.js";
import { extractBearerToken, headerValue } from "../http.js";
import {
  AuthError,
  type AuthSession,
  type DevLoginInput,
  type IncomingAuthRequest,
} from "../types.js";

export type ClerkAuthAdapterOptions = {
  secretKey: string;
  publishableKey?: string;
};

/**
 * Clerk IdP adapter. Only this module may import `@clerk/*` (ADR-004).
 */
export class ClerkAuthAdapter implements AuthProvider {
  readonly name = "clerk" as const;
  private readonly secretKey: string;
  private readonly clerk: ReturnType<typeof createClerkClient>;

  constructor(options: ClerkAuthAdapterOptions) {
    if (!options.secretKey) {
      throw new AuthError("CLERK_SECRET_KEY is required for AUTH_PROVIDER=clerk", {
        statusCode: 500,
        code: "misconfigured",
      });
    }
    this.secretKey = options.secretKey;
    this.clerk = createClerkClient({
      secretKey: options.secretKey,
      publishableKey: options.publishableKey,
    });
  }

  async createDevSession(_input: DevLoginInput): Promise<never> {
    throw new AuthError("Dev login is disabled when AUTH_PROVIDER=clerk", {
      statusCode: 404,
      code: "not_found",
    });
  }

  async authenticateRequest(request: IncomingAuthRequest): Promise<AuthSession | null> {
    const token = extractBearerToken(request);
    if (!token) return null;

    try {
      const payload = await verifyToken(token, {
        secretKey: this.secretKey,
      });

      const userId = payload.sub;
      if (!userId) return null;

      const user = await this.clerk.users.getUser(userId);
      const primaryEmail =
        user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)?.emailAddress ??
        user.emailAddresses[0]?.emailAddress ??
        null;

      if (!primaryEmail) {
        throw new AuthError("Clerk user has no email", {
          statusCode: 401,
          code: "invalid_identity",
        });
      }

      const displayName =
        [user.firstName, user.lastName].filter(Boolean).join(" ").trim() || user.username || null;

      return {
        provider: "clerk",
        idpUserId: userId,
        email: primaryEmail.toLowerCase(),
        displayName,
        avatarUrl: user.imageUrl ?? null,
        sessionId: String(payload.sid ?? payload.azp ?? userId),
      };
    } catch (err) {
      if (err instanceof AuthError) throw err;
      return null;
    }
  }

  async logout(request: IncomingAuthRequest): Promise<void> {
    const sessionId = headerValue(request.headers, "x-clerk-session-id");
    if (!sessionId) {
      // Bearer JWT logout without session id: client must drop the token.
      // Server-side revoke requires a session id from Clerk.
      return;
    }
    try {
      await this.clerk.sessions.revokeSession(sessionId);
    } catch {
      // Best-effort revoke; client still drops the bearer token.
    }
  }
}
