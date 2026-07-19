/**
 * Prisma ciphertext store (Phase 28a / ADR-013).
 * Structurally compatible with verse-core SecretsVaultCipherStore — no Core import.
 */
import type { PrismaClient } from "./client.js";

export type VaultCipherBlob = {
  ciphertext: string;
  iv: string;
  auth_tag: string;
};

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
  }): Promise<VaultCipherBlob | null>;
  deleteCipher(input: {
    organization_id: string;
    workspace_id: string;
    ref: string;
  }): Promise<void>;
};

export function createPrismaSecretsVaultCipherStore(
  prisma: PrismaClient,
): SecretsVaultCipherStore {
  return {
    async putCipher(input) {
      await prisma.vaultSecretRow.upsert({
        where: {
          workspaceId_ref: {
            workspaceId: input.workspace_id,
            ref: input.ref,
          },
        },
        create: {
          organizationId: input.organization_id,
          workspaceId: input.workspace_id,
          ref: input.ref,
          ciphertext: input.ciphertext,
          iv: input.iv,
          authTag: input.auth_tag,
        },
        update: {
          ciphertext: input.ciphertext,
          iv: input.iv,
          authTag: input.auth_tag,
        },
      });
    },

    async getCipher(input) {
      const row = await prisma.vaultSecretRow.findUnique({
        where: {
          workspaceId_ref: {
            workspaceId: input.workspace_id,
            ref: input.ref,
          },
        },
      });
      if (!row) return null;
      return {
        ciphertext: row.ciphertext,
        iv: row.iv,
        auth_tag: row.authTag,
      };
    },

    async deleteCipher(input) {
      await prisma.vaultSecretRow.deleteMany({
        where: {
          workspaceId: input.workspace_id,
          ref: input.ref,
        },
      });
    },
  };
}
