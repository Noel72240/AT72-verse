/**
 * LinkedIn (and stub) token exchange — Core only (ADR-013).
 * Never imported by Agents / Skills / Runtime / Host.
 */
import type { ConnectorProviderId } from "@at72-verse/contracts";

export type OAuthTokenBundle = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  /** Non-secret hint for UI (e.g. member id). */
  external_account_hint?: string;
};

export type OAuthProviderPort = {
  provider: ConnectorProviderId;
  buildAuthorizeUrl(input: {
    client_id: string;
    redirect_uri: string;
    state: string;
    scopes: string[];
  }): string;
  exchangeCode(input: {
    client_id: string;
    client_secret: string;
    redirect_uri: string;
    code: string;
  }): Promise<OAuthTokenBundle>;
  revoke?(input: {
    client_id: string;
    client_secret: string;
    token: string;
  }): Promise<void>;
};

/** Deterministic stub for CI / local without LinkedIn apps (VERSE_OAUTH_STUB=1). */
export class StubLinkedInOAuthProvider implements OAuthProviderPort {
  readonly provider = "linkedin" as const;

  buildAuthorizeUrl(input: {
    client_id: string;
    redirect_uri: string;
    state: string;
    scopes: string[];
  }): string {
    const u = new URL("https://www.linkedin.com/oauth/v2/authorization");
    u.searchParams.set("response_type", "code");
    u.searchParams.set("client_id", input.client_id || "stub-client");
    u.searchParams.set("redirect_uri", input.redirect_uri);
    u.searchParams.set("state", input.state);
    u.searchParams.set("scope", input.scopes.join(" "));
    u.searchParams.set("verse_stub", "1");
    return u.toString();
  }

  async exchangeCode(input: {
    client_id: string;
    client_secret: string;
    redirect_uri: string;
    code: string;
  }): Promise<OAuthTokenBundle> {
    if (!input.code.trim()) {
      throw new Error("OAUTH_INVALID_CODE");
    }
    return {
      access_token: `stub-access-${input.code.trim()}`,
      refresh_token: `stub-refresh-${input.code.trim()}`,
      expires_in: 3600,
      external_account_hint: "stub-linkedin-member",
    };
  }

  async revoke(): Promise<void> {
    /* no-op */
  }
}

export class LinkedInOAuthProvider implements OAuthProviderPort {
  readonly provider = "linkedin" as const;

  constructor(
    private readonly fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  buildAuthorizeUrl(input: {
    client_id: string;
    redirect_uri: string;
    state: string;
    scopes: string[];
  }): string {
    const u = new URL("https://www.linkedin.com/oauth/v2/authorization");
    u.searchParams.set("response_type", "code");
    u.searchParams.set("client_id", input.client_id);
    u.searchParams.set("redirect_uri", input.redirect_uri);
    u.searchParams.set("state", input.state);
    u.searchParams.set("scope", input.scopes.join(" "));
    return u.toString();
  }

  async exchangeCode(input: {
    client_id: string;
    client_secret: string;
    redirect_uri: string;
    code: string;
  }): Promise<OAuthTokenBundle> {
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code: input.code,
      redirect_uri: input.redirect_uri,
      client_id: input.client_id,
      client_secret: input.client_secret,
    });
    const res = await this.fetchImpl("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!res.ok) {
      throw new Error("OAUTH_TOKEN_EXCHANGE_FAILED");
    }
    const json = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!json.access_token) {
      throw new Error("OAUTH_TOKEN_EXCHANGE_FAILED");
    }
    return {
      access_token: json.access_token,
      refresh_token: json.refresh_token,
      expires_in: json.expires_in,
    };
  }

  async revoke(input: {
    client_id: string;
    client_secret: string;
    token: string;
  }): Promise<void> {
    const body = new URLSearchParams({
      token: input.token,
      client_id: input.client_id,
      client_secret: input.client_secret,
    });
    await this.fetchImpl("https://www.linkedin.com/oauth/v2/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  }
}

export function createLinkedInOAuthProvider(): OAuthProviderPort {
  const stub =
    process.env.VERSE_OAUTH_STUB === "1" ||
    (!process.env.LINKEDIN_CLIENT_ID && !process.env.LINKEDIN_CLIENT_SECRET);
  return stub ? new StubLinkedInOAuthProvider() : new LinkedInOAuthProvider();
}
