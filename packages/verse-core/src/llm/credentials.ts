/**
 * Credential resolver (Phase 13 / AV1 · ADR-005).
 * Platform key only; BYOK seams present but inactive.
 */
import type { LlmCredentialSource } from "@at72-verse/contracts";
import { KernelError } from "@at72-verse/verse-kernel";

export type ResolvedCredentials = {
  apiKey: string;
  credential_source: LlmCredentialSource;
};

export type CredentialResolverOptions = {
  /** Override for tests. */
  platformApiKey?: string | null;
  /** When true, attempt org/workspace/agent keys (always off in Phase 13). */
  byokEnabled?: boolean;
};

/**
 * Hierarchical resolver — Phase 13 always lands on platform (AV1).
 * Seams for agent → org → workspace remain for future BYOK.
 */
export function resolvePlatformCredentials(
  options: CredentialResolverOptions = {},
): ResolvedCredentials {
  const byokEnabled = options.byokEnabled ?? false;

  // Seams (inactive): agent → organization → workspace
  if (byokEnabled) {
    // Future: resolve tenant vault refs. Intentionally empty in P13.
  }

  const apiKey =
    options.platformApiKey !== undefined
      ? options.platformApiKey
      : (process.env.OPENAI_API_KEY ?? process.env.LLM_API_KEY ?? null);

  if (!apiKey) {
    throw new KernelError(
      "AUTH",
      "No platform LLM credentials configured (set OPENAI_API_KEY or LLM_API_KEY)",
      { details: { credential_source: "platform" } },
    );
  }

  return {
    apiKey,
    credential_source: "platform",
  };
}

export function hasPlatformLlmCredentials(): boolean {
  return Boolean(process.env.OPENAI_API_KEY ?? process.env.LLM_API_KEY);
}
