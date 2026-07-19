/**
 * Meta (Facebook / Instagram) OAuth — Core only (ADR-013).
 * Never imported by Agents / Skills / Runtime / Host.
 */
import type { ConnectorProviderId } from "@at72-verse/contracts";
import type { OAuthProviderPort, OAuthTokenBundle } from "./linkedin-oauth-provider.js";

const GRAPH_VERSION = "v21.0";

const META_SCOPES: Record<"facebook" | "instagram", readonly string[]> = {
  facebook: [
    "public_profile",
    "pages_show_list",
    "pages_manage_posts",
    "pages_read_engagement",
  ],
  instagram: [
    "public_profile",
    "pages_show_list",
    "pages_read_engagement",
    "instagram_basic",
    "instagram_content_publish",
    "business_management",
  ],
};

export function metaScopesFor(provider: "facebook" | "instagram"): readonly string[] {
  return META_SCOPES[provider];
}

/** Deterministic stub for CI / local without a Meta app (VERSE_OAUTH_STUB=1). */
export class StubMetaOAuthProvider implements OAuthProviderPort {
  constructor(readonly provider: "facebook" | "instagram") {}

  buildAuthorizeUrl(input: {
    client_id: string;
    redirect_uri: string;
    state: string;
    scopes: string[];
  }): string {
    const u = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
    u.searchParams.set("client_id", input.client_id || "stub-meta-app");
    u.searchParams.set("redirect_uri", input.redirect_uri);
    u.searchParams.set("state", input.state);
    u.searchParams.set("scope", input.scopes.join(","));
    u.searchParams.set("response_type", "code");
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
      access_token: `stub-meta-access-${input.code.trim()}`,
      expires_in: 3600,
      external_account_hint: `stub-${this.provider}-account`,
    };
  }

  async revoke(): Promise<void> {
    /* no-op */
  }
}

export class MetaOAuthProvider implements OAuthProviderPort {
  constructor(
    readonly provider: "facebook" | "instagram",
    private readonly fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
  ) {}

  buildAuthorizeUrl(input: {
    client_id: string;
    redirect_uri: string;
    state: string;
    scopes: string[];
  }): string {
    const u = new URL(`https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`);
    u.searchParams.set("client_id", input.client_id);
    u.searchParams.set("redirect_uri", input.redirect_uri);
    u.searchParams.set("state", input.state);
    u.searchParams.set("scope", input.scopes.join(","));
    u.searchParams.set("response_type", "code");
    return u.toString();
  }

  async exchangeCode(input: {
    client_id: string;
    client_secret: string;
    redirect_uri: string;
    code: string;
  }): Promise<OAuthTokenBundle> {
    const u = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
    u.searchParams.set("client_id", input.client_id);
    u.searchParams.set("client_secret", input.client_secret);
    u.searchParams.set("redirect_uri", input.redirect_uri);
    u.searchParams.set("code", input.code);

    const res = await this.fetchImpl(u.toString());
    if (!res.ok) {
      throw new Error("OAUTH_TOKEN_EXCHANGE_FAILED");
    }
    const json = (await res.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!json.access_token) {
      throw new Error("OAUTH_TOKEN_EXCHANGE_FAILED");
    }

    let hint: string | undefined;
    try {
      const meRes = await this.fetchImpl(
        `https://graph.facebook.com/${GRAPH_VERSION}/me?fields=id,name&access_token=${encodeURIComponent(json.access_token)}`,
      );
      if (meRes.ok) {
        const me = (await meRes.json()) as { id?: string; name?: string };
        hint = me.name ? `${me.name} (${me.id ?? "?"})` : me.id;
      }
    } catch {
      /* hint is optional */
    }

    return {
      access_token: json.access_token,
      expires_in: json.expires_in,
      external_account_hint: hint ?? `meta-${this.provider}`,
    };
  }

  async revoke(input: {
    client_id: string;
    client_secret: string;
    token: string;
  }): Promise<void> {
    const u = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/me/permissions`);
    u.searchParams.set("access_token", input.token);
    await this.fetchImpl(u.toString(), { method: "DELETE" });
  }
}

export function createMetaOAuthProvider(
  provider: "facebook" | "instagram",
): OAuthProviderPort {
  const stub =
    process.env.VERSE_OAUTH_STUB === "1" ||
    (!process.env.META_APP_ID && !process.env.META_APP_SECRET);
  return stub ? new StubMetaOAuthProvider(provider) : new MetaOAuthProvider(provider);
}

export function isMetaProvider(
  provider: ConnectorProviderId,
): provider is "facebook" | "instagram" {
  return provider === "facebook" || provider === "instagram";
}
