import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  InMemorySecretsVaultCipherStore,
  LocalEncryptedSecretsVault,
} from "./local-encrypted-secrets-vault.js";

describe("LocalEncryptedSecretsVault Phase 28a", () => {
  it("round-trips plaintext without storing it in the cipher store", async () => {
    const store = new InMemorySecretsVaultCipherStore();
    const vault = new LocalEncryptedSecretsVault({
      masterKey: "a".repeat(64),
      store,
    });
    const org = "11111111-1111-4111-8111-111111111101";
    const ws = "22222222-2222-4222-8222-222222222201";

    await vault.put({
      organization_id: org,
      workspace_id: ws,
      ref: "conn-1",
      plaintext: "access-token-secret-value",
    });

    const cipher = await store.getCipher({
      organization_id: org,
      workspace_id: ws,
      ref: "conn-1",
    });
    assert.ok(cipher);
    assert.equal(cipher!.ciphertext.includes("access-token-secret-value"), false);
    assert.equal(JSON.stringify(cipher).includes("access-token-secret-value"), false);

    const got = await vault.get({
      organization_id: org,
      workspace_id: ws,
      ref: "conn-1",
    });
    assert.equal(got, "access-token-secret-value");

    await vault.delete({ organization_id: org, workspace_id: ws, ref: "conn-1" });
    assert.equal(await vault.get({ organization_id: org, workspace_id: ws, ref: "conn-1" }), null);
  });

  it("isolates refs across workspaces", async () => {
    const vault = new LocalEncryptedSecretsVault({ masterKey: "b".repeat(64) });
    const org = "11111111-1111-4111-8111-111111111102";
    await vault.put({
      organization_id: org,
      workspace_id: "ws-a",
      ref: "same-ref",
      plaintext: "token-a",
    });
    await vault.put({
      organization_id: org,
      workspace_id: "ws-b",
      ref: "same-ref",
      plaintext: "token-b",
    });
    assert.equal(
      await vault.get({ organization_id: org, workspace_id: "ws-a", ref: "same-ref" }),
      "token-a",
    );
    assert.equal(
      await vault.get({ organization_id: org, workspace_id: "ws-b", ref: "same-ref" }),
      "token-b",
    );
  });
});
