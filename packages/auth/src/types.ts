/**
 * Provider-agnostic auth types (ADR-004, Phase 05).
 */

export type AuthProviderName = "clerk" | "dev";

/** Identity claims from the IdP — no Verse RBAC here. */
export type AuthIdentity = {
  /** IdP subject (Clerk user id, or synthetic id in dev). */
  idpUserId: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  sessionId: string;
};

export type AuthSession = AuthIdentity & {
  provider: AuthProviderName;
};

export type IncomingAuthRequest = {
  headers: Headers | Record<string, string | string[] | undefined>;
};

export type DevLoginInput = {
  email: string;
  displayName?: string | null;
  avatarUrl?: string | null;
  /** Optional stable idp id; defaults to a generated dev_* id. */
  idpUserId?: string;
};

export class AuthError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, options?: { statusCode?: number; code?: string }) {
    super(message);
    this.name = "AuthError";
    this.statusCode = options?.statusCode ?? 401;
    this.code = options?.code ?? "unauthorized";
  }
}
