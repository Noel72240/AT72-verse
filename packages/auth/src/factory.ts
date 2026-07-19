import { ClerkAuthAdapter } from "./adapters/clerk-auth-adapter.js";
import { DevAuthAdapter } from "./adapters/dev-auth-adapter.js";
import type { AuthProvider } from "./ports/auth-provider.js";
import { AuthError, type AuthProviderName } from "./types.js";

export type CreateAuthProviderOptions = {
  provider?: AuthProviderName | string;
  clerkSecretKey?: string;
  clerkPublishableKey?: string;
  /** Reuse a shared DevAuthAdapter instance (API process / tests). */
  devAdapter?: DevAuthAdapter;
};

/**
 * Factory selected by `AUTH_PROVIDER` (`clerk` | `dev`).
 * Default: `dev` (safe for CI / local without Clerk keys).
 */
export function createAuthProvider(options: CreateAuthProviderOptions = {}): AuthProvider {
  const provider = (options.provider ?? process.env.AUTH_PROVIDER ?? "dev") as string;

  if (provider === "dev") {
    return options.devAdapter ?? new DevAuthAdapter();
  }

  if (provider === "clerk") {
    return new ClerkAuthAdapter({
      secretKey: options.clerkSecretKey ?? process.env.CLERK_SECRET_KEY ?? "",
      publishableKey: options.clerkPublishableKey ?? process.env.CLERK_PUBLISHABLE_KEY,
    });
  }

  throw new AuthError(`Unknown AUTH_PROVIDER: ${provider}`, {
    statusCode: 500,
    code: "misconfigured",
  });
}
