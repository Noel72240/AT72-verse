import { randomUUID } from "node:crypto";
import type { AuthProvider } from "../ports/auth-provider.js";
import { extractBearerToken } from "../http.js";
import {
  AuthError,
  type AuthSession,
  type DevLoginInput,
  type IncomingAuthRequest,
} from "../types.js";

type StoredSession = AuthSession & { accessToken: string };

/**
 * In-memory IdP for local/CI. Not for production.
 */
export class DevAuthAdapter implements AuthProvider {
  readonly name = "dev" as const;
  private readonly sessions = new Map<string, StoredSession>();

  async createDevSession(
    input: DevLoginInput,
  ): Promise<{ accessToken: string; session: AuthSession }> {
    const email = input.email.trim().toLowerCase();
    if (!email) {
      throw new AuthError("email is required", {
        statusCode: 400,
        code: "invalid_input",
      });
    }

    const accessToken = `dev_${randomUUID().replaceAll("-", "")}`;
    const session: AuthSession = {
      provider: "dev",
      idpUserId: input.idpUserId?.trim() || `dev_${email}`,
      email,
      displayName: input.displayName ?? null,
      avatarUrl: input.avatarUrl ?? null,
      sessionId: randomUUID(),
    };

    this.sessions.set(accessToken, { ...session, accessToken });
    return { accessToken, session };
  }

  async authenticateRequest(request: IncomingAuthRequest): Promise<AuthSession | null> {
    const token = extractBearerToken(request);
    if (!token) return null;
    const stored = this.sessions.get(token);
    if (!stored) return null;
    const { accessToken: _token, ...session } = stored;
    return session;
  }

  async logout(request: IncomingAuthRequest): Promise<void> {
    const token = extractBearerToken(request);
    if (token) {
      this.sessions.delete(token);
    }
  }

  /** Test helper — clears all sessions. */
  clear(): void {
    this.sessions.clear();
  }
}
