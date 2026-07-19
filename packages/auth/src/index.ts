/**
 * @at72-verse/auth — IdP ports and adapters (ADR-004, Phase 05).
 *
 * Application code must import from this package only — never `@clerk/*`.
 */
export type { AuthProvider } from "./ports/auth-provider.js";
export type {
  AuthProviderName,
  AuthIdentity,
  AuthSession,
  IncomingAuthRequest,
  DevLoginInput,
} from "./types.js";
export { AuthError } from "./types.js";
export { extractBearerToken, headerValue } from "./http.js";
export { DevAuthAdapter } from "./adapters/dev-auth-adapter.js";
export { ClerkAuthAdapter } from "./adapters/clerk-auth-adapter.js";
export type { ClerkAuthAdapterOptions } from "./adapters/clerk-auth-adapter.js";
export { createAuthProvider, type CreateAuthProviderOptions } from "./factory.js";

export const packageName = "@at72-verse/auth" as const;
