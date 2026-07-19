/**
 * Meta (Facebook / Instagram) OAuth — Core only (ADR-013).
 * Never imported by Agents / Skills / Runtime / Host.
 */
import type { ConnectorProviderId } from "@at72-verse/contracts";
import type { OAuthProviderPort, OAuthTokenBundle } from "./linkedin-oauth-provider.js";

const GRAPH_VERSION = "v21.0";

export type MetaPagePublic = {
  id: string;
  name: string;
  has_instagram: boolean;
};

/** Load Pages administered by the user; prefer AlloTech72 when present. */
export async function fetchMetaPagesForToken(
  userAccessToken: string,
  fetchImpl: typeof fetch = globalThis.fetch.bind(globalThis),
): Promise<Partial<OAuthTokenBundle>> {
  const u = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/me/accounts`);
  u.searchParams.set(
    "fields",
    "id,name,access_token,instagram_business_account{id}",
  );
  u.searchParams.set("access_token", userAccessToken);
  const res = await fetchImpl(u.toString());
  if (!res.ok) {
    return {};
  }
  const json = (await res.json()) as {
    data?: Array<{
      id?: string;
      name?: string;
      access_token?: string;
      instagram_business_account?: { id?: string };
    }>;
  };
  const meta_pages = (json.data ?? [])
    .filter((p) => p.id && p.name && p.access_token)
    .map((p) => ({
      id: p.id!,
      name: p.name!,
      access_token: p.access_token!,
      ...(p.instagram_business_account?.id
        ? { ig_user_id: p.instagram_business_account.id }
        : {}),
    }));
  if (meta_pages.length === 0) return { meta_pages: [] };

  const preferred =
    meta_pages.find((p) => /allotech/i.test(p.name)) ??
    (meta_pages.length === 1 ? meta_pages[0] : undefined);

  if (!preferred) {
    return { meta_pages };
  }
  return {
    meta_pages,
    page_id: preferred.id,
    page_name: preferred.name,
    page_access_token: preferred.access_token,
    ...(preferred.ig_user_id ? { ig_user_id: preferred.ig_user_id } : {}),
  };
}

const META_SCOPES: Record<"facebook" | "instagram", readonly string[]> = {
  // Requires +Ajouter in Meta App → Facebook Login → Permissions (dev/tester OK).
  facebook: [
    "public_profile",
    "pages_show_list",
    "pages_manage_posts",
    "pages_read_engagement",
    "instagram_basic",
    "instagram_content_publish",
  ],
  instagram: [
    "public_profile",
    "pages_show_list",
    "pages_manage_posts",
    "pages_read_engagement",
    "instagram_basic",
    "instagram_content_publish",
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
      external_account_hint: "Page AlloTech72 (stub)",
      page_id: "stub-page-allotech72",
      page_name: "AlloTech72",
      page_access_token: `stub-page-token-${input.code.trim()}`,
      ig_user_id: "stub-ig-allotech72",
      meta_pages: [
        {
          id: "stub-page-allotech72",
          name: "AlloTech72",
          access_token: `stub-page-token-${input.code.trim()}`,
          ig_user_id: "stub-ig-allotech72",
        },
      ],
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
    u.searchParams.set("response_type", "code");
    // Facebook Login for Business: config_id carries permissions (preferred).
    const configId = process.env.META_LOGIN_CONFIG_ID?.trim();
    if (configId) {
      u.searchParams.set("config_id", configId);
    } else {
      u.searchParams.set("scope", input.scopes.join(","));
      // Re-prompt Page/IG scopes if previously granted only public_profile.
      u.searchParams.set("auth_type", "rerequest");
    }
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
    let pageFields: Partial<OAuthTokenBundle> = {};
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

    try {
      pageFields = await fetchMetaPagesForToken(json.access_token, this.fetchImpl);
      if (pageFields.page_name) {
        hint = `Page ${pageFields.page_name}`;
      }
    } catch {
      /* pages optional until permissions granted */
    }

    return {
      access_token: json.access_token,
      expires_in: json.expires_in,
      external_account_hint: hint ?? `meta-${this.provider}`,
      ...pageFields,
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
