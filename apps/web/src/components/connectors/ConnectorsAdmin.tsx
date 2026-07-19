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

export function ConnectorsAdmin() {
  const [orgs, setOrgs] = useState<OrgMembership[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [connections, setConnections] = useState<ApiConnectorConnection[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      window.location.href = "/login";
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected")) {
      setNotice(`Connected: ${params.get("connected")} (${params.get("status") ?? "ok"})`);
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

  async function connectLinkedIn() {
    if (!workspaceId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await startWorkspaceConnector(workspaceId, "linkedin");
      const url = new URL(res.authorize_url);
      const state = url.searchParams.get("state");
      if (url.searchParams.get("verse_stub") === "1" && state) {
        window.location.href = `${getApiBase()}/connectors/oauth/callback?stub_code=dev-stub&state=${encodeURIComponent(state)}`;
        return;
      }
      window.location.href = res.authorize_url;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  async function disconnectLinkedIn() {
    if (!workspaceId) return;
    setBusy(true);
    setError(null);
    try {
      await disconnectWorkspaceConnector(workspaceId, "linkedin");
      setNotice("LinkedIn disconnected");
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const linkedin = connections.find((c) => c.provider === "linkedin" && c.status === "connected");

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
      </nav>

      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Connectors</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
        Phase 28a — OAuth LinkedIn connect / disconnect. Secrets stay in Core vault; publish live is
        Phase 28b.
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

      <section
        style={{
          padding: "1rem 0",
          borderTop: "1px solid var(--border, #333)",
          borderBottom: "1px solid var(--border, #333)",
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
            <div style={{ fontFamily: "var(--font-ibm-mono), monospace" }}>linkedin</div>
            <div style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              {linkedin
                ? `Status: ${linkedin.status}${linkedin.external_account_hint ? ` · ${linkedin.external_account_hint}` : ""}`
                : "Not connected"}
            </div>
          </div>
          {linkedin ? (
            <button type="button" disabled={busy} onClick={() => void disconnectLinkedIn()}>
              Disconnect
            </button>
          ) : (
            <button
              type="button"
              disabled={busy || !workspaceId}
              onClick={() => void connectLinkedIn()}
            >
              Connect
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
