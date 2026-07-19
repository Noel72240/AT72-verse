"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  createOrganization,
  getStoredOrgId,
  getStoredWorkspaceId,
  getToken,
  listOrganizations,
  listWorkspaceGrants,
  listWorkspaces,
  setStoredOrgId,
  setStoredWorkspaceId,
  setWorkspaceGrant,
  type ApiPermissionGrant,
  type OrgMembership,
  type Workspace,
} from "@/lib/api";

const KIND_ORDER: Record<string, number> = { agent: 0, skill: 1, tool: 2 };

export function GrantsAdmin() {
  const [orgs, setOrgs] = useState<OrgMembership[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [grants, setGrants] = useState<ApiPermissionGrant[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      window.location.href = "/login";
      return;
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
      const res = await listWorkspaceGrants(workspaceId);
      const sorted = [...res.grants].sort((a, b) => {
        const k = (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9);
        return k !== 0 ? k : a.capability_id.localeCompare(b.capability_id);
      });
      setGrants(sorted);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggle(grant: ApiPermissionGrant) {
    if (!workspaceId) return;
    setBusy(true);
    setError(null);
    try {
      await setWorkspaceGrant(workspaceId, {
        kind: grant.kind,
        capability_id: grant.capability_id,
        enabled: !grant.enabled,
        require_approval: grant.require_approval,
      });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  async function toggleApproval(grant: ApiPermissionGrant) {
    if (!workspaceId || grant.kind !== "tool") return;
    setBusy(true);
    setError(null);
    try {
      await setWorkspaceGrant(workspaceId, {
        kind: grant.kind,
        capability_id: grant.capability_id,
        enabled: grant.enabled,
        require_approval: !grant.require_approval,
      });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        maxWidth: "52rem",
        margin: "0 auto",
        padding: "2rem 1.25rem 4rem",
        color: "var(--text)",
      }}
    >
      <nav style={{ display: "flex", gap: "1.25rem", marginBottom: "2rem" }}>
        <a href="/chat" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Chat
        </a>
        <a href="/workflows" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Workflows
        </a>
        <a href="/persona" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Persona
        </a>
        <a href="/memory" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Memory
        </a>
        <a href="/grants" style={{ color: "var(--accent)", fontSize: "0.9rem" }}>
          Grants
        </a>
        <a href="/connectors" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Connectors
        </a>
        <a href="/approvals" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Approvals
        </a>
        <a href="/packages" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Packages
        </a>
      </nav>

      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2rem", margin: "0 0 0.5rem" }}>
        Capability grants
      </h1>
      <p style={{ color: "var(--text-muted)", margin: "0 0 1.5rem", lineHeight: 1.5 }}>
        Active ou désactive Agents, Skills et Tools pour ce workspace. Sur les tools à
        side-effect, active aussi <code>require_approval</code> (HITL Phase 29) — les
        workspaces existants restent à false jusqu&apos;à activation explicite.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1.25rem" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.85rem" }}>
          Organisation
          <select
            value={orgId ?? ""}
            onChange={(e) => {
              setOrgId(e.target.value);
              setStoredOrgId(e.target.value);
            }}
            style={{ minWidth: "12rem", padding: "0.4rem" }}
          >
            {orgs.map((m) => (
              <option key={m.organization.id} value={m.organization.id}>
                {m.organization.name}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.85rem" }}>
          Workspace
          <select
            value={workspaceId ?? ""}
            onChange={(e) => {
              setWorkspaceId(e.target.value);
              setStoredWorkspaceId(e.target.value);
            }}
            style={{ minWidth: "12rem", padding: "0.4rem" }}
          >
            {workspaces.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => void load()}
          disabled={busy || !workspaceId}
          style={{
            alignSelf: "flex-end",
            padding: "0.45rem 0.9rem",
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            cursor: "pointer",
          }}
        >
          {busy ? "…" : "Actualiser"}
        </button>
      </div>

      {error ? (
        <p style={{ color: "var(--danger, #c44)", marginBottom: "1rem" }}>{error}</p>
      ) : null}

      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {grants.map((g) => (
          <li
            key={g.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              padding: "0.75rem 0",
              borderBottom: "1px solid var(--border, #333)",
            }}
          >
            <div>
              <div style={{ fontFamily: "var(--font-ibm-mono), monospace", fontSize: "0.95rem" }}>
                {g.capability_id}
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>{g.kind}</div>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
              {g.kind === "tool" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void toggleApproval(g)}
                  aria-pressed={g.require_approval}
                  title="Require human approval for live side-effects"
                  style={{
                    minWidth: "7.5rem",
                    padding: "0.4rem 0.75rem",
                    border: "1px solid var(--border, #444)",
                    background: g.require_approval ? "var(--accent)" : "transparent",
                    color: g.require_approval ? "#fff" : "var(--text-muted)",
                    cursor: "pointer",
                  }}
                >
                  {g.require_approval ? "HITL on" : "HITL off"}
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => void toggle(g)}
                aria-pressed={g.enabled}
                style={{
                  minWidth: "6.5rem",
                  padding: "0.4rem 0.75rem",
                  border: "1px solid var(--border, #444)",
                  background: g.enabled ? "var(--accent)" : "transparent",
                  color: g.enabled ? "#fff" : "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                {g.enabled ? "Enabled" : "Disabled"}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
