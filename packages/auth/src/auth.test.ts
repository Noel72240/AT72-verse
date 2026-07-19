import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { DevAuthAdapter } from "./adapters/dev-auth-adapter.js";
import { createAuthProvider } from "./factory.js";
import { AuthError } from "./types.js";

describe("@at72-verse/auth DevAuthAdapter", () => {
  let adapter: DevAuthAdapter;

  beforeEach(() => {
    adapter = new DevAuthAdapter();
  });

  it("login → authenticate → logout invalidates session", async () => {
    const { accessToken, session } = await adapter.createDevSession({
      email: "Alice@Example.com",
      displayName: "Alice",
      avatarUrl: "https://example.com/a.png",
    });

    assert.equal(session.email, "alice@example.com");
    assert.equal(session.provider, "dev");
    assert.ok(session.idpUserId.startsWith("dev_"));

    const authed = await adapter.authenticateRequest({
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(authed?.sessionId, session.sessionId);
    assert.equal(authed?.displayName, "Alice");

    await adapter.logout({
      headers: { authorization: `Bearer ${accessToken}` },
    });

    const after = await adapter.authenticateRequest({
      headers: { authorization: `Bearer ${accessToken}` },
    });
    assert.equal(after, null);
  });

  it("createAuthProvider defaults to dev", () => {
    const provider = createAuthProvider({ provider: "dev", devAdapter: adapter });
    assert.equal(provider.name, "dev");
  });

  it("rejects empty email on dev login", async () => {
    await assert.rejects(
      () => adapter.createDevSession({ email: "  " }),
      (err: unknown) => err instanceof AuthError && err.statusCode === 400,
    );
  });
});
