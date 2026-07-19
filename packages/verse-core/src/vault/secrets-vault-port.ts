/**
 * SecretsVaultPort — Phase 28a / ADR-013.
 * Sole entry point for connector secret material in Core.
 * Plaintext exists only ephemerally for the duration of a connector call.
 */
export type VaultSecretRef = string;

export type SecretsVaultPutInput = {
  organization_id: string;
  workspace_id: string;
  /** Stable opaque reference (e.g. connection id). */
  ref: VaultSecretRef;
  plaintext: string;
};

export type SecretsVaultGetInput = {
  organization_id: string;
  workspace_id: string;
  ref: VaultSecretRef;
};

export type SecretsVaultPort = {
  put(input: SecretsVaultPutInput): Promise<void>;
  /** Returns plaintext for immediate use only — caller must not persist/log/bus. */
  get(input: SecretsVaultGetInput): Promise<string | null>;
  delete(input: SecretsVaultGetInput): Promise<void>;
};

/** Persistence of ciphertext blobs only (never plaintext). */
export type SecretsVaultCipherStore = {
  putCipher(input: {
    organization_id: string;
    workspace_id: string;
    ref: string;
    ciphertext: string;
    iv: string;
    auth_tag: string;
  }): Promise<void>;
  getCipher(input: {
    organization_id: string;
    workspace_id: string;
    ref: string;
  }): Promise<{ ciphertext: string; iv: string; auth_tag: string } | null>;
  deleteCipher(input: {
    organization_id: string;
    workspace_id: string;
    ref: string;
  }): Promise<void>;
};
