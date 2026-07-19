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

    const existing = await this.store.getByWorkspaceProvider(
      pending.workspace_id,
      pending.provider,
    );
    const id = existing?.id ?? randomUUID();
    const vault_ref = `connector:${id}`;
    const now = new Date().toISOString();

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
      provider: pending.provider,
      status: "connected",
      vault_ref,
      external_account_hint: tokens.external_account_hint ?? null,
      connected_at: now,
      revoked_at: null,
      updated_at: now,
    });

    return toPublicConnection(record);
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
   * Caller (Core only) must not log/persist/bus the return value.
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
    return parseTokenBundle(plaintext).access_token;
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
  });
}

function parseTokenBundle(plaintext: string): OAuthTokenBundle {
  const json = JSON.parse(plaintext) as {
    access_token: string;
    refresh_token?: string | null;
    expires_in?: number | null;
  };
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token ?? undefined,
    expires_in: json.expires_in ?? undefined,
  };
}
