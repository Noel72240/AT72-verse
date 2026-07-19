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
  opts?: { app_id?: string; app_secret?: string },
): Promise<Partial<OAuthTokenBundle> & { pages_diagnostic?: string }> {
  let token = userAccessToken;

  // Long-lived user token improves /me/accounts reliability.
  if (opts?.app_id && opts?.app_secret) {
    try {
      const ex = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`);
      ex.searchParams.set("grant_type", "fb_exchange_token");
      ex.searchParams.set("client_id", opts.app_id);
      ex.searchParams.set("client_secret", opts.app_secret);
      ex.searchParams.set("fb_exchange_token", userAccessToken);
      const exRes = await fetchImpl(ex.toString());
      if (exRes.ok) {
        const exJson = (await exRes.json()) as { access_token?: string };
        if (exJson.access_token) token = exJson.access_token;
      }
    } catch {
      /* keep short-lived */
    }
  }

  const u = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/me/accounts`);
  u.searchParams.set(
    "fields",
    "id,name,access_token,instagram_business_account{id}",
  );
  u.searchParams.set("limit", "100");
  u.searchParams.set("access_token", token);
  const res = await fetchImpl(u.toString());
  const json = (await res.json()) as {
    data?: Array<{
      id?: string;
      name?: string;
      access_token?: string;
      instagram_business_account?: { id?: string };
    }>;
    error?: { message?: string; code?: number; error_subcode?: number };
  };

  if (!res.ok || json.error) {
    const msg = json.error?.message ?? `Graph me/accounts HTTP ${res.status}`;
    return { meta_pages: [], pages_diagnostic: msg, ...(token !== userAccessToken ? { access_token: token } : {}) };
  }

  const raw = json.data ?? [];
  const meta_pages: NonNullable<OAuthTokenBundle["meta_pages"]> = [];

  for (const p of raw) {
    if (!p.id || !p.name) continue;
    let pageToken = p.access_token;
    if (!pageToken) {
      try {
        const pt = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${p.id}`);
        pt.searchParams.set("fields", "access_token,instagram_business_account{id}");
        pt.searchParams.set("access_token", token);
        const ptRes = await fetchImpl(pt.toString());
        if (ptRes.ok) {
          const ptJson = (await ptRes.json()) as {
            access_token?: string;
            instagram_business_account?: { id?: string };
          };
          pageToken = ptJson.access_token;
          if (!p.instagram_business_account && ptJson.instagram_business_account) {
            p.instagram_business_account = ptJson.instagram_business_account;
          }
        }
      } catch {
        /* skip token fill */
      }
    }
    if (!pageToken) continue;
    meta_pages.push({
      id: p.id,
      name: p.name,
      access_token: pageToken,
      ...(p.instagram_business_account?.id
        ? { ig_user_id: p.instagram_business_account.id }
        : {}),
    });
  }

  // Business Pages (AlloTech72 in BM) often omit from me/accounts — recover via granular_scopes.
  if (meta_pages.length === 0 && opts?.app_id && opts?.app_secret) {
    try {
      const dbg = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/debug_token`);
      dbg.searchParams.set("input_token", token);
      dbg.searchParams.set("access_token", `${opts.app_id}|${opts.app_secret}`);
      const dbgRes = await fetchImpl(dbg.toString());
      if (dbgRes.ok) {
        const dbgJson = (await dbgRes.json()) as {
          data?: {
            granular_scopes?: Array<{ scope?: string; target_ids?: string[] }>;
          };
        };
        const pageIds = new Set<string>();
        for (const g of dbgJson.data?.granular_scopes ?? []) {
          if (
            g.scope === "pages_show_list" ||
            g.scope === "pages_manage_posts" ||
            g.scope === "pages_read_engagement" ||
            g.scope === "pages_manage_engagement"
          ) {
            for (const id of g.target_ids ?? []) {
              if (id) pageIds.add(id);
            }
          }
        }
        for (const pageId of pageIds) {
          const pt = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/${pageId}`);
          pt.searchParams.set(
            "fields",
            "id,name,access_token,instagram_business_account{id}",
          );
          pt.searchParams.set("access_token", token);
          const ptRes = await fetchImpl(pt.toString());
          if (!ptRes.ok) continue;
          const ptJson = (await ptRes.json()) as {
            id?: string;
            name?: string;
            access_token?: string;
            instagram_business_account?: { id?: string };
          };
          if (!ptJson.id || !ptJson.name || !ptJson.access_token) continue;
          meta_pages.push({
            id: ptJson.id,
            name: ptJson.name,
            access_token: ptJson.access_token,
            ...(ptJson.instagram_business_account?.id
              ? { ig_user_id: ptJson.instagram_business_account.id }
              : {}),
          });
        }
      }
    } catch {
      /* fall through to diagnostic */
    }
  }

  const base: Partial<OAuthTokenBundle> & { pages_diagnostic?: string } = {
    meta_pages,
    ...(token !== userAccessToken ? { access_token: token } : {}),
  };

  if (meta_pages.length === 0) {
    let pages_diagnostic = raw.length
      ? `${raw.length} Page(s) listée(s) sans token (permissions Pages incomplètes)`
      : "Aucune Page (me/accounts vide — Page Business : ajoute business_management puis reconnecte)";
    try {
      const permUrl = new URL(`https://graph.facebook.com/${GRAPH_VERSION}/me/permissions`);
      permUrl.searchParams.set("access_token", token);
      const permRes = await fetchImpl(permUrl.toString());
      if (permRes.ok) {
        const permJson = (await permRes.json()) as {
          data?: Array<{ permission?: string; status?: string }>;
        };
        const granted = (permJson.data ?? [])
          .filter((x) => x.status === "granted" && x.permission)
          .map((x) => x.permission!);
        pages_diagnostic += `. Permissions: ${granted.join(", ") || "(aucune)"}`;
      }
    } catch {
      /* ignore */
    }
    return { ...base, pages_diagnostic };
  }

  const preferred =
    meta_pages.find((p) => /allotech/i.test(p.name)) ??
    (meta_pages.length === 1 ? meta_pages[0] : undefined);

  if (!preferred) {
    return base;
  }
  return {
    ...base,
    page_id: preferred.id,
    page_name: preferred.name,
    page_access_token: preferred.access_token,
    ...(preferred.ig_user_id ? { ig_user_id: preferred.ig_user_id } : {}),
  };
}

const META_SCOPES: Record<"facebook" | "instagram", readonly string[]> = {
  // business_management required for Pages linked to Meta Business Manager.
  facebook: [
    "public_profile",
    "business_management",
    "pages_show_list",
    "pages_manage_posts",
    "pages_read_engagement",
    "instagram_basic",
    "instagram_content_publish",
  ],
  instagram: [
    "public_profile",
    "business_management",
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
    let pageFields: Partial<OAuthTokenBundle> & { pages_diagnostic?: string } = {};
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
      pageFields = await fetchMetaPagesForToken(json.access_token, this.fetchImpl, {
        app_id: input.client_id,
        app_secret: input.client_secret,
      });
      if (pageFields.access_token) {
        json.access_token = pageFields.access_token;
      }
      if (pageFields.page_name) {
        hint = `Page ${pageFields.page_name}`;
      }
    } catch {
      /* pages optional until permissions granted */
    }

    const { pages_diagnostic: _diag, ...pageBundle } = pageFields;
    return {
      access_token: json.access_token,
      expires_in: json.expires_in,
      external_account_hint: hint ?? `meta-${this.provider}`,
      ...pageBundle,
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
