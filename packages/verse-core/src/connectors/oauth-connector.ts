import { randomUUID } from "node:crypto";
import type { ConnectorConnectionPublic, ConnectorProviderId } from "@at72-verse/contracts";
import type { SecretsVaultPort } from "../vault/secrets-vault-port.js";
import {
  type ConnectorStorePort,
  toPublicConnection,
} from "./connector-store-port.js";
import {
  createLinkedInOAuthProvider,
  type OAuthProviderPort,
  type OAuthTokenBundle,
} from "./linkedin-oauth-provider.js";
import {
  createMetaOAuthProvider,
  metaScopesFor,
} from "./meta-oauth-provider.js";

const LINKEDIN_SCOPES = ["openid", "profile", "w_member_social"] as const;

const SUPPORTED_PROVIDERS: readonly ConnectorProviderId[] = [
  "linkedin",
  "facebook",
  "instagram",
];

type PendingOAuth = {
  organization_id: string;
  workspace_id: string;
  provider: ConnectorProviderId;
  redirect_uri: string;
  created_at: number;
};

type ProviderRuntime = {
  port: OAuthProviderPort;
  clientId: string;
  clientSecret: string;
  scopes: readonly string[];
};

export type OAuthConnectorOptions = {
  vault: SecretsVaultPort;
  store: ConnectorStorePort;
  /**
   * Optional override for LinkedIn only (tests).
   * Prefer `providers` for multi-network setups.
   */
  provider?: OAuthProviderPort;
  /** Per-provider OAuth adapters (linkedin / facebook / instagram). */
  providers?: Partial<Record<ConnectorProviderId, OAuthProviderPort>>;
  /** Platform LinkedIn app credentials — never passed to Agents/Runtime. */
  linkedin?: { client_id?: string; client_secret?: string };
  /** Meta app credentials (Facebook + Instagram Login). */
  meta?: { app_id?: string; app_secret?: string };
  /** Pending state TTL ms (default 10 min). */
  pending_ttl_ms?: number;
};

/**
 * OAuthConnector — Core only (ADR-013).
 * Entire OAuth sequence (authorize, callback, state, code, refresh, revoke)
 * stays in API ↔ Core. No OAuth material leaves this class toward Agents/Skills/Runtime/Host.
 */
export class OAuthConnector {
  private vault: SecretsVaultPort;
  private store: ConnectorStorePort;
  private readonly runtimes: Map<ConnectorProviderId, ProviderRuntime>;
  private readonly pendingTtlMs: number;
  /** state → pending — Core memory only; never exposed on public DTOs. */
  private readonly pending = new Map<string, PendingOAuth>();

  constructor(options: OAuthConnectorOptions) {
    this.vault = options.vault;
    this.store = options.store;
    this.pendingTtlMs = options.pending_ttl_ms ?? 10 * 60 * 1000;

    const linkedInClientId =
      options.linkedin?.client_id ?? process.env.LINKEDIN_CLIENT_ID ?? "stub-client";
    const linkedInClientSecret =
      options.linkedin?.client_secret ?? process.env.LINKEDIN_CLIENT_SECRET ?? "stub-secret";
    const metaAppId = options.meta?.app_id ?? process.env.META_APP_ID ?? "stub-meta-app";
    const metaAppSecret =
      options.meta?.app_secret ?? process.env.META_APP_SECRET ?? "stub-meta-secret";

    const linkedInPort =
      options.providers?.linkedin ?? options.provider ?? createLinkedInOAuthProvider();
    const facebookPort = options.providers?.facebook ?? createMetaOAuthProvider("facebook");
    const instagramPort = options.providers?.instagram ?? createMetaOAuthProvider("instagram");

    this.runtimes = new Map([
      [
        "linkedin",
        {
          port: linkedInPort,
          clientId: linkedInClientId,
          clientSecret: linkedInClientSecret,
          scopes: LINKEDIN_SCOPES,
        },
      ],
      [
        "facebook",
        {
          port: facebookPort,
          clientId: metaAppId,
          clientSecret: metaAppSecret,
          scopes: metaScopesFor("facebook"),
        },
      ],
      [
        "instagram",
        {
          port: instagramPort,
          clientId: metaAppId,
          clientSecret: metaAppSecret,
          scopes: metaScopesFor("instagram"),
        },
      ],
    ]);
  }

  setVault(vault: SecretsVaultPort): void {
    this.vault = vault;
  }

  setStore(store: ConnectorStorePort): void {
    this.store = store;
  }

  /**
   * Start OAuth — returns authorize URL only (no secrets).
   * `state` is retained in Core; callers must not persist it beyond redirect.
   */
  async startAuthorize(input: {
    organization_id: string;
    workspace_id: string;
    provider: ConnectorProviderId;
    redirect_uri: string;
  }): Promise<{ authorize_url: string; provider: ConnectorProviderId }> {
    const runtime = this.runtimes.get(input.provider);
    if (!runtime || !SUPPORTED_PROVIDERS.includes(input.provider)) {
      throw Object.assign(new Error("UNSUPPORTED_PROVIDER"), { code: "UNSUPPORTED_PROVIDER" });
    }
    this.purgeExpiredPending();
    const state = randomUUID();
    this.pending.set(state, {
      organization_id: input.organization_id,
      workspace_id: input.workspace_id,
      provider: input.provider,
      redirect_uri: input.redirect_uri,
      created_at: Date.now(),
    });
    const authorize_url = runtime.port.buildAuthorizeUrl({
      client_id: runtime.clientId,
      redirect_uri: input.redirect_uri,
      state,
      scopes: [...runtime.scopes],
    });
    return { authorize_url, provider: input.provider };
  }

  /**
   * Complete OAuth callback — consumes code+state inside Core.
   * Returns public connection metadata only.
   */
  async handleCallback(input: {
    code: string;
    state: string;
  }): Promise<ConnectorConnectionPublic> {
    this.purgeExpiredPending();
    const pending = this.pending.get(input.state);
    this.pending.delete(input.state);
    if (!pending) {
      throw Object.assign(new Error("OAUTH_INVALID_STATE"), { code: "OAUTH_INVALID_STATE" });
    }
    if (!input.code?.trim()) {
      throw Object.assign(new Error("OAUTH_INVALID_CODE"), { code: "OAUTH_INVALID_CODE" });
    }

    const runtime = this.runtimes.get(pending.provider);
    if (!runtime) {
      throw Object.assign(new Error("UNSUPPORTED_PROVIDER"), { code: "UNSUPPORTED_PROVIDER" });
    }

    const tokens = await runtime.port.exchangeCode({
      client_id: runtime.clientId,
      client_secret: runtime.clientSecret,
      redirect_uri: pending.redirect_uri,
      code: input.code.trim(),
    });

    // Meta Login is one Facebook dialog for both FB + IG — persist both connectors.
    const providersToSave: ConnectorProviderId[] =
      pending.provider === "facebook" || pending.provider === "instagram"
        ? ["facebook", "instagram"]
        : [pending.provider];

    const now = new Date().toISOString();
    let primary: ConnectorConnectionPublic | null = null;

    for (const provider of providersToSave) {
      const existing = await this.store.getByWorkspaceProvider(
        pending.workspace_id,
        provider,
      );
      const id = existing?.id ?? randomUUID();
      const vault_ref = `connector:${id}`;

      await this.vault.put({
        organization_id: pending.organization_id,
        workspace_id: pending.workspace_id,
        ref: vault_ref,
        plaintext: serializeTokenBundle(tokens),
      });

      const record = await this.store.upsert({
        id,
        organization_id: pending.organization_id,
        workspace_id: pending.workspace_id,
        provider,
        status: "connected",
        vault_ref,
        external_account_hint: tokens.external_account_hint ?? null,
        connected_at: now,
        revoked_at: null,
        updated_at: now,
      });
      const publicRow = toPublicConnection(record);
      if (provider === pending.provider) primary = publicRow;
    }

    return primary ?? toPublicConnection({
      id: randomUUID(),
      organization_id: pending.organization_id,
      workspace_id: pending.workspace_id,
      provider: pending.provider,
      status: "connected",
      vault_ref: "",
      external_account_hint: tokens.external_account_hint ?? null,
      connected_at: now,
      revoked_at: null,
      updated_at: now,
    });
  }

  async list(workspace_id: string): Promise<ConnectorConnectionPublic[]> {
    const rows = await this.store.listByWorkspace(workspace_id);
    return rows.map(toPublicConnection);
  }

  async getStatus(
    workspace_id: string,
    provider: ConnectorProviderId,
  ): Promise<ConnectorConnectionPublic | null> {
    const row = await this.store.getByWorkspaceProvider(workspace_id, provider);
    return row ? toPublicConnection(row) : null;
  }

  /**
   * Revoke at provider (best-effort) + delete vault secret + mark revoked.
   */
  async revoke(input: {
    workspace_id: string;
    provider: ConnectorProviderId;
  }): Promise<ConnectorConnectionPublic | null> {
    const row = await this.store.getByWorkspaceProvider(input.workspace_id, input.provider);
    if (!row) return null;

    const runtime = this.runtimes.get(input.provider);
    const plaintext = await this.vault.get({
      organization_id: row.organization_id,
      workspace_id: row.workspace_id,
      ref: row.vault_ref,
    });
    if (plaintext && runtime?.port.revoke) {
      try {
        const bundle = parseTokenBundle(plaintext);
        await runtime.port.revoke({
          client_id: runtime.clientId,
          client_secret: runtime.clientSecret,
          token: bundle.access_token,
        });
      } catch {
        /* best-effort revoke */
      }
    }

    await this.vault.delete({
      organization_id: row.organization_id,
      workspace_id: row.workspace_id,
      ref: row.vault_ref,
    });

    const now = new Date().toISOString();
    const updated = await this.store.upsert({
      ...row,
      status: "revoked",
      vault_ref: row.vault_ref,
      revoked_at: now,
      updated_at: now,
    });
    return toPublicConnection(updated);
  }

  async disconnect(input: {
    workspace_id: string;
    provider: ConnectorProviderId;
  }): Promise<void> {
    await this.revoke(input);
    const row = await this.store.getByWorkspaceProvider(input.workspace_id, input.provider);
    if (row) {
      await this.store.delete(row.id);
    }
  }

  /**
   * Resolve access token for ToolRuntime live path (Phase 28b).
   * Meta: prefers Page token (publish as AlloTech72), not the user profile token.
   */
  async resolveAccessToken(input: {
    workspace_id: string;
    provider: ConnectorProviderId;
  }): Promise<string | null> {
    const row = await this.store.getByWorkspaceProvider(input.workspace_id, input.provider);
    if (!row || row.status !== "connected") return null;
    const plaintext = await this.vault.get({
      organization_id: row.organization_id,
      workspace_id: row.workspace_id,
      ref: row.vault_ref,
    });
    if (!plaintext) return null;
    const bundle = parseTokenBundle(plaintext);
    if (
      (input.provider === "facebook" || input.provider === "instagram") &&
      bundle.page_access_token
    ) {
      return bundle.page_access_token;
    }
    return bundle.access_token;
  }

  /** Public Page list (no tokens) for UI selection. Re-fetches from Graph if vault has none. */
  async listMetaPages(input: {
    workspace_id: string;
  }): Promise<{
    selected_page_id: string | null;
    selected_page_name: string | null;
    pages: Array<{ id: string; name: string; has_instagram: boolean }>;
    pages_diagnostic?: string | null;
  }> {
    const row =
      (await this.store.getByWorkspaceProvider(input.workspace_id, "facebook")) ??
      (await this.store.getByWorkspaceProvider(input.workspace_id, "instagram"));
    if (!row || row.status !== "connected") {
      return { selected_page_id: null, selected_page_name: null, pages: [], pages_diagnostic: null };
    }
    const plaintext = await this.vault.get({
      organization_id: row.organization_id,
      workspace_id: row.workspace_id,
      ref: row.vault_ref,
    });
    if (!plaintext) {
      return { selected_page_id: null, selected_page_name: null, pages: [], pages_diagnostic: null };
    }
    let bundle = parseTokenBundle(plaintext);
    let pages_diagnostic: string | null = null;

    // Always refresh when no usable Pages — OAuth may have stored user-only token.
    if (!bundle.meta_pages?.length && bundle.access_token) {
      try {
        const { fetchMetaPagesForToken } = await import("./meta-oauth-provider.js");
        const runtime = this.runtimes.get("facebook") ?? this.runtimes.get("instagram");
        const pageFields = await fetchMetaPagesForToken(bundle.access_token, globalThis.fetch.bind(globalThis), {
          app_id: runtime?.clientId,
          app_secret: runtime?.clientSecret,
        });
        pages_diagnostic = pageFields.pages_diagnostic ?? null;
        const { pages_diagnostic: _d, ...fields } = pageFields;
        if (fields.meta_pages?.length || fields.access_token) {
          bundle = {
            ...bundle,
            ...fields,
            external_account_hint: fields.page_name
              ? `Page ${fields.page_name}`
              : bundle.external_account_hint,
          };
          const providers: ConnectorProviderId[] = ["facebook", "instagram"];
          for (const provider of providers) {
            const pRow = await this.store.getByWorkspaceProvider(input.workspace_id, provider);
            if (!pRow || pRow.status !== "connected") continue;
            await this.vault.put({
              organization_id: pRow.organization_id,
              workspace_id: pRow.workspace_id,
              ref: pRow.vault_ref,
              plaintext: serializeTokenBundle(bundle),
            });
            if (bundle.page_name) {
              await this.store.upsert({
                ...pRow,
                external_account_hint: `Page ${bundle.page_name}`,
                updated_at: new Date().toISOString(),
              });
            }
          }
        }
      } catch (e) {
        pages_diagnostic = e instanceof Error ? e.message : String(e);
      }
    }

    const pages = (bundle.meta_pages ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      has_instagram: Boolean(p.ig_user_id),
    }));
    return {
      selected_page_id: bundle.page_id ?? null,
      selected_page_name: bundle.page_name ?? null,
      pages,
      pages_diagnostic: pages.length ? null : pages_diagnostic,
    };
  }

  /** Pin which Facebook Page (e.g. AlloTech72) receives live posts. */
  async selectMetaPage(input: {
    workspace_id: string;
    page_id: string;
  }): Promise<ConnectorConnectionPublic | null> {
    const providers: ConnectorProviderId[] = ["facebook", "instagram"];
    let primary: ConnectorConnectionPublic | null = null;
    for (const provider of providers) {
      const row = await this.store.getByWorkspaceProvider(input.workspace_id, provider);
      if (!row || row.status !== "connected") continue;
      const plaintext = await this.vault.get({
        organization_id: row.organization_id,
        workspace_id: row.workspace_id,
        ref: row.vault_ref,
      });
      if (!plaintext) continue;
      const bundle = parseTokenBundle(plaintext);
      const page = (bundle.meta_pages ?? []).find((p) => p.id === input.page_id);
      if (!page) {
        throw Object.assign(new Error("META_PAGE_NOT_FOUND"), { code: "META_PAGE_NOT_FOUND" });
      }
      const next: OAuthTokenBundle = {
        ...bundle,
        page_id: page.id,
        page_name: page.name,
        page_access_token: page.access_token,
        ...(page.ig_user_id ? { ig_user_id: page.ig_user_id } : { ig_user_id: undefined }),
        external_account_hint: `Page ${page.name}`,
      };
      await this.vault.put({
        organization_id: row.organization_id,
        workspace_id: row.workspace_id,
        ref: row.vault_ref,
        plaintext: serializeTokenBundle(next),
      });
      const now = new Date().toISOString();
      const updated = await this.store.upsert({
        ...row,
        external_account_hint: `Page ${page.name}`,
        updated_at: now,
      });
      if (provider === "facebook") primary = toPublicConnection(updated);
      if (!primary) primary = toPublicConnection(updated);
    }
    return primary;
  }

  /** Expose IG user id for Instagram Graph publish (Core only). */
  async resolveMetaPublishContext(input: {
    workspace_id: string;
    provider: "facebook" | "instagram";
  }): Promise<{
    access_token: string;
    page_id: string | null;
    page_name: string | null;
    ig_user_id: string | null;
  } | null> {
    const row = await this.store.getByWorkspaceProvider(input.workspace_id, input.provider);
    if (!row || row.status !== "connected") return null;
    const plaintext = await this.vault.get({
      organization_id: row.organization_id,
      workspace_id: row.workspace_id,
      ref: row.vault_ref,
    });
    if (!plaintext) return null;
    const bundle = parseTokenBundle(plaintext);
    const access_token = bundle.page_access_token ?? bundle.access_token;
    if (!access_token) return null;
    return {
      access_token,
      page_id: bundle.page_id ?? null,
      page_name: bundle.page_name ?? null,
      ig_user_id: bundle.ig_user_id ?? null,
    };
  }

  private purgeExpiredPending(): void {
    const now = Date.now();
    for (const [state, p] of this.pending) {
      if (now - p.created_at > this.pendingTtlMs) this.pending.delete(state);
    }
  }
}

function serializeTokenBundle(tokens: OAuthTokenBundle): string {
  return JSON.stringify({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? null,
    expires_in: tokens.expires_in ?? null,
    page_id: tokens.page_id ?? null,
    page_name: tokens.page_name ?? null,
    page_access_token: tokens.page_access_token ?? null,
    ig_user_id: tokens.ig_user_id ?? null,
    meta_pages: tokens.meta_pages ?? null,
  });
}

function parseTokenBundle(plaintext: string): OAuthTokenBundle {
  const json = JSON.parse(plaintext) as {
    access_token: string;
    refresh_token?: string | null;
    expires_in?: number | null;
    page_id?: string | null;
    page_name?: string | null;
    page_access_token?: string | null;
    ig_user_id?: string | null;
    meta_pages?: OAuthTokenBundle["meta_pages"] | null;
  };
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? undefined,
    expires_in: json.expires_in ?? undefined,
    ...(json.page_id ? { page_id: json.page_id } : {}),
    ...(json.page_name ? { page_name: json.page_name } : {}),
    ...(json.page_access_token ? { page_access_token: json.page_access_token } : {}),
    ...(json.ig_user_id ? { ig_user_id: json.ig_user_id } : {}),
    ...(json.meta_pages ? { meta_pages: json.meta_pages } : {}),
  };
}
