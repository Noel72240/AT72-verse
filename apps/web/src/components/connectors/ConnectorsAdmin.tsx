"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  createOrganization,
  disconnectWorkspaceConnector,
  getApiBase,
  getStoredOrgId,
  getStoredWorkspaceId,
  getToken,
  listOrganizations,
  listWorkspaceConnectors,
  listWorkspaces,
  setStoredOrgId,
  setStoredWorkspaceId,
  startWorkspaceConnector,
  type ApiConnectorConnection,
  type OrgMembership,
  type Workspace,
} from "@/lib/api";

const PROVIDERS = [
  {
    id: "linkedin" as const,
    label: "LinkedIn",
    hint: "Publication live disponible depuis le chat (« publie en live »).",
  },
  {
    id: "facebook" as const,
    label: "Facebook",
    hint: "Connexion Meta (compte Leon / admin Allotech72). Live publication bientôt.",
  },
  {
    id: "instagram" as const,
    label: "Instagram",
    hint: "Meta ouvre Facebook Login (normal). Une connexion Meta active FB + IG.",
  },
];

export function ConnectorsAdmin() {
  const [orgs, setOrgs] = useState<OrgMembership[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [connections, setConnections] = useState<ApiConnectorConnection[]>([]);
  const [busy, setBusy] = useState(false);
  const [busyProvider, setBusyProvider] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      window.location.href = "/login";
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    if (connected) {
      const label =
        connected === "facebook" || connected === "instagram"
          ? "Facebook + Instagram (Meta)"
          : connected;
      setNotice(`Connecté : ${label} (${params.get("status") ?? "ok"})`);
      // Drop Facebook's `#_=_` noise and keep a clean URL after reload.
      window.history.replaceState({}, "", "/connectors");
    }
    void (async () => {
      try {
        let memberships = await listOrganizations();
        if (memberships.length === 0) {
          const slug = `demo-${Date.now().toString(36)}`;
          await createOrganization("Demo Org", slug);
          memberships = await listOrganizations();
        }
        setOrgs(memberships);
        const preferredOrg = getStoredOrgId() ?? memberships[0]?.organization.id ?? null;
        setOrgId(preferredOrg);
        if (preferredOrg) setStoredOrgId(preferredOrg);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  useEffect(() => {
    if (!orgId) return;
    void (async () => {
      try {
        const ws = await listWorkspaces(orgId);
        setWorkspaces(ws);
        const preferred =
          getStoredWorkspaceId() && ws.some((w) => w.id === getStoredWorkspaceId())
            ? getStoredWorkspaceId()
            : (ws[0]?.id ?? null);
        setWorkspaceId(preferred);
        if (preferred) setStoredWorkspaceId(preferred);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [orgId]);

  const load = useCallback(async () => {
    if (!workspaceId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await listWorkspaceConnectors(workspaceId);
      setConnections(res.connections);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  // After OAuth redirect, re-fetch once workspace is ready (avoids empty « Non connecté » flash).
  useEffect(() => {
    if (!workspaceId || !notice) return;
    const t = window.setTimeout(() => void load(), 300);
    return () => window.clearTimeout(t);
  }, [workspaceId, notice, load]);

  async function connectProvider(provider: (typeof PROVIDERS)[number]["id"]) {
    if (!workspaceId) return;
    setBusyProvider(provider);
    setError(null);
    try {
      const res = await startWorkspaceConnector(workspaceId, provider);
      const url = new URL(res.authorize_url);
      const state = url.searchParams.get("state");
      if (url.searchParams.get("verse_stub") === "1" && state) {
        window.location.href = `${getApiBase()}/connectors/oauth/callback?stub_code=dev-stub&state=${encodeURIComponent(state)}`;
        return;
      }
      window.location.href = res.authorize_url;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
      setBusyProvider(null);
    }
  }

  async function disconnectProvider(provider: (typeof PROVIDERS)[number]["id"]) {
    if (!workspaceId) return;
    setBusyProvider(provider);
    setError(null);
    try {
      await disconnectWorkspaceConnector(workspaceId, provider);
      setNotice(`${provider} déconnecté`);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusyProvider(null);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "2rem auto", padding: "0 1rem" }}>
      <nav style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        <a href="/chat" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Chat
        </a>
        <a href="/workflows" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Workflows
        </a>
        <a href="/grants" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Grants
        </a>
        <a href="/packages" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Packages
        </a>
        <a href="/connectors" style={{ color: "var(--accent)", fontSize: "0.9rem" }}>
          Connectors
        </a>
        <a href="/approvals" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Approvals
        </a>
      </nav>

      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Connecteurs</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
        LinkedIn = connexion LinkedIn. Facebook et Instagram = <strong>Meta</strong> : le bouton
        Instagram ouvre aussi l&apos;écran Facebook Login (compte Leon) — c&apos;est normal. Une
        connexion Meta active les deux.
      </p>

      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" }}>
        <label>
          Org{" "}
          <select
            value={orgId ?? ""}
            onChange={(e) => {
              setOrgId(e.target.value);
              setStoredOrgId(e.target.value);
            }}
          >
            {orgs.map((m) => (
              <option key={m.organization.id} value={m.organization.id}>
                {m.organization.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Workspace{" "}
          <select
            value={workspaceId ?? ""}
            onChange={(e) => {
              setWorkspaceId(e.target.value);
              setStoredWorkspaceId(e.target.value);
            }}
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {notice ? (
        <p style={{ color: "var(--accent)", marginBottom: "1rem" }}>{notice}</p>
      ) : null}
      {error ? (
        <p style={{ color: "var(--danger, #c44)", marginBottom: "1rem" }}>{error}</p>
      ) : null}

      {PROVIDERS.map((p) => {
        const conn = connections.find((c) => c.provider === p.id && c.status === "connected");
        const rowBusy = busy || busyProvider === p.id;
        return (
          <section
            key={p.id}
            style={{
              padding: "1rem 0",
              borderTop: "1px solid var(--border, #333)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "1rem",
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>{p.label}</div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
                  {conn
                    ? `Connecté${conn.external_account_hint ? ` · ${conn.external_account_hint}` : ""}`
                    : "Non connecté"}
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "0.25rem" }}>
                  {p.hint}
                </div>
              </div>
              {conn ? (
                <button
                  type="button"
                  disabled={rowBusy || !workspaceId}
                  onClick={() => void disconnectProvider(p.id)}
                >
                  Déconnecter
                </button>
              ) : (
                <button
                  type="button"
                  disabled={rowBusy || !workspaceId}
                  onClick={() => void connectProvider(p.id)}
                >
                  Connecter
                </button>
              )}
            </div>
          </section>
        );
      })}
    </main>
  );
}
