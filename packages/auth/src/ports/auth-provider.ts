import type {
  AuthProviderName,
  AuthSession,
  DevLoginInput,
  IncomingAuthRequest,
} from "../types.js";

/**
 * Single application-facing auth port. Apps must not import Clerk SDKs.
 */
export interface AuthProvider {
  readonly name: AuthProviderName;

  /**
   * Resolves the current IdP session from the HTTP request, or null if anonymous.
   */
  authenticateRequest(request: IncomingAuthRequest): Promise<AuthSession | null>;

  /**
   * Invalidates the current session when possible (dev: drop token; clerk: revoke).
   */
  logout(request: IncomingAuthRequest): Promise<void>;

  /**
   * Dev-only session minting. Clerk adapter must reject.
   */
  createDevSession?(input: DevLoginInput): Promise<{ accessToken: string; session: AuthSession }>;
}
