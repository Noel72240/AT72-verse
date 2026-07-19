import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import type {
  SecretsVaultCipherStore,
  SecretsVaultGetInput,
  SecretsVaultPort,
  SecretsVaultPutInput,
} from "./secrets-vault-port.js";

const ALGO = "aes-256-gcm" as const;

export class InMemorySecretsVaultCipherStore implements SecretsVaultCipherStore {
  private readonly rows = new Map<string, { ciphertext: string; iv: string; auth_tag: string }>();

  private key(organization_id: string, workspace_id: string, ref: string): string {
    return `${organization_id}:${workspace_id}:${ref}`;
  }

  async putCipher(input: {
    organization_id: string;
    workspace_id: string;
    ref: string;
    ciphertext: string;
    iv: string;
    auth_tag: string;
  }): Promise<void> {
    this.rows.set(this.key(input.organization_id, input.workspace_id, input.ref), {
      ciphertext: input.ciphertext,
      iv: input.iv,
      auth_tag: input.auth_tag,
    });
  }

  async getCipher(input: {
    organization_id: string;
    workspace_id: string;
    ref: string;
  }): Promise<{ ciphertext: string; iv: string; auth_tag: string } | null> {
    return this.rows.get(this.key(input.organization_id, input.workspace_id, input.ref)) ?? null;
  }

  async deleteCipher(input: {
    organization_id: string;
    workspace_id: string;
    ref: string;
  }): Promise<void> {
    this.rows.delete(this.key(input.organization_id, input.workspace_id, input.ref));
  }
}

function resolveMasterKey(masterKey?: string | Buffer): Buffer {
  if (Buffer.isBuffer(masterKey)) {
    if (masterKey.length !== 32) {
      throw new Error("VERSE_VAULT_MASTER_KEY buffer must be 32 bytes");
    }
    return masterKey;
  }
  const fromEnv = masterKey ?? process.env.VERSE_VAULT_MASTER_KEY ?? "";
  if (fromEnv.length === 64 && /^[0-9a-fA-F]+$/.test(fromEnv)) {
    return Buffer.from(fromEnv, "hex");
  }
  if (fromEnv.length > 0) {
    return scryptSync(fromEnv, "at72-verse-vault-v1", 32);
  }
  // Ephemeral key for tests / local without env — data not durable across restarts.
  return scryptSync("verse-dev-ephemeral-vault", "at72-verse-vault-v1", 32);
}

/**
 * Local encrypted vault (ADR-013 / DX4).
 * Stores ciphertext only via cipher store; plaintext never written to the store.
 */
export class LocalEncryptedSecretsVault implements SecretsVaultPort {
  private readonly key: Buffer;
  private readonly store: SecretsVaultCipherStore;

  constructor(options?: { masterKey?: string | Buffer; store?: SecretsVaultCipherStore }) {
    this.key = resolveMasterKey(options?.masterKey);
    this.store = options?.store ?? new InMemorySecretsVaultCipherStore();
  }

  async put(input: SecretsVaultPutInput): Promise<void> {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGO, this.key, iv);
    const enc = Buffer.concat([cipher.update(input.plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();
    await this.store.putCipher({
      organization_id: input.organization_id,
      workspace_id: input.workspace_id,
      ref: input.ref,
      ciphertext: enc.toString("base64"),
      iv: iv.toString("base64"),
      auth_tag: authTag.toString("base64"),
    });
  }

  async get(input: SecretsVaultGetInput): Promise<string | null> {
    const row = await this.store.getCipher(input);
    if (!row) return null;
    const decipher = createDecipheriv(ALGO, this.key, Buffer.from(row.iv, "base64"));
    decipher.setAuthTag(Buffer.from(row.auth_tag, "base64"));
    const dec = Buffer.concat([
      decipher.update(Buffer.from(row.ciphertext, "base64")),
      decipher.final(),
    ]);
    return dec.toString("utf8");
  }

  async delete(input: SecretsVaultGetInput): Promise<void> {
    await this.store.deleteCipher(input);
  }
}
