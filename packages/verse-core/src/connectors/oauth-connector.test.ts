import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LocalEncryptedSecretsVault } from "../vault/local-encrypted-secrets-vault.js";
import { InMemoryConnectorStore } from "./connector-store-port.js";
import { StubLinkedInOAuthProvider } from "./linkedin-oauth-provider.js";
import { OAuthConnector } from "./oauth-connector.js";

describe("OAuthConnector Phase 28a", () => {
  const org = "11111111-1111-4111-8111-111111111201";
  const ws = "22222222-2222-4222-8222-222222222201";

  function createConnector(): OAuthConnector {
    return new OAuthConnector({
      vault: new LocalEncryptedSecretsVault({ masterKey: "c".repeat(64) }),
      store: new InMemoryConnectorStore(),
      provider: new StubLinkedInOAuthProvider(),
      linkedin: { client_id: "test-client", client_secret: "test-secret" },
    });
  }

  it("connect then revoke: public DTO has no token material; resolve clears after revoke", async () => {
    const oauth = createConnector();
    const start = await oauth.startAuthorize({
      organization_id: org,
      workspace_id: ws,
      provider: "linkedin",
      redirect_uri: "http://localhost:3001/connectors/oauth/callback",
    });
    assert.ok(start.authorize_url.includes("state="));
    assert.equal(JSON.stringify(start).includes("test-secret"), false);

    const state = new URL(start.authorize_url).searchParams.get("state")!;
    const connected = await oauth.handleCallback({ code: "auth-code-1", state });
    assert.equal(connected.status, "connected");
    assert.equal(connected.provider, "linkedin");
    assert.equal(JSON.stringify(connected).includes("stub-access"), false);
    assert.equal(JSON.stringify(connected).includes("auth-code"), false);

    const token = await oauth.resolveAccessToken({ workspace_id: ws, provider: "linkedin" });
    assert.equal(token, "stub-access-auth-code-1");

    const revoked = await oauth.revoke({ workspace_id: ws, provider: "linkedin" });
    assert.equal(revoked?.status, "revoked");
    assert.equal(
      await oauth.resolveAccessToken({ workspace_id: ws, provider: "linkedin" }),
      null,
    );
  });

  it("disconnect removes connection metadata", async () => {
    const oauth = createConnector();
    const start = await oauth.startAuthorize({
      organization_id: org,
      workspace_id: ws,
      provider: "linkedin",
      redirect_uri: "http://localhost/cb",
    });
    const state = new URL(start.authorize_url).searchParams.get("state")!;
    await oauth.handleCallback({ code: "c2", state });
    await oauth.disconnect({ workspace_id: ws, provider: "linkedin" });
    assert.equal(await oauth.getStatus(ws, "linkedin"), null);
    assert.deepEqual(await oauth.list(ws), []);
  });

  it("rejects invalid state", async () => {
    const oauth = createConnector();
    await assert.rejects(
      () => oauth.handleCallback({ code: "x", state: "missing" }),
      (err: Error & { code?: string }) => err.code === "OAUTH_INVALID_STATE",
    );
  });

  it("connect facebook via Meta stub", async () => {
    const { StubMetaOAuthProvider } = await import("./meta-oauth-provider.js");
    const oauth = new OAuthConnector({
      vault: new LocalEncryptedSecretsVault({ masterKey: "c".repeat(64) }),
      store: new InMemoryConnectorStore(),
      providers: { facebook: new StubMetaOAuthProvider("facebook") },
      meta: { app_id: "meta-app", app_secret: "meta-secret" },
    });
    const start = await oauth.startAuthorize({
      organization_id: org,
      workspace_id: ws,
      provider: "facebook",
      redirect_uri: "http://localhost:3001/connectors/oauth/callback",
    });
    assert.ok(start.authorize_url.includes("facebook.com"));
    const state = new URL(start.authorize_url).searchParams.get("state")!;
    const connected = await oauth.handleCallback({ code: "fb-code", state });
    assert.equal(connected.provider, "facebook");
    assert.equal(connected.status, "connected");
    const token = await oauth.resolveAccessToken({ workspace_id: ws, provider: "facebook" });
    assert.equal(token, "stub-meta-access-fb-code");
  });

  it("connect instagram via Meta stub", async () => {
    const { StubMetaOAuthProvider } = await import("./meta-oauth-provider.js");
    const oauth = new OAuthConnector({
      vault: new LocalEncryptedSecretsVault({ masterKey: "d".repeat(64) }),
      store: new InMemoryConnectorStore(),
      providers: { instagram: new StubMetaOAuthProvider("instagram") },
    });
    const start = await oauth.startAuthorize({
      organization_id: org,
      workspace_id: ws,
      provider: "instagram",
      redirect_uri: "http://localhost/cb",
    });
    const state = new URL(start.authorize_url).searchParams.get("state")!;
    const connected = await oauth.handleCallback({ code: "ig-code", state });
    assert.equal(connected.provider, "instagram");
    assert.match(String(connected.external_account_hint), /instagram/);
  });
});
