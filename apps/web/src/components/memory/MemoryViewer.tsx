"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  createOrganization,
  createWorkspaceMemory,
  forgetWorkspaceMemory,
  getStoredOrgId,
  getStoredWorkspaceId,
  getToken,
  listOrganizations,
  listWorkspaceMemory,
  listWorkspaces,
  pinWorkspaceMemory,
  setStoredOrgId,
  setStoredWorkspaceId,
  type ApiMemoryRecord,
  type OrgMembership,
  type Workspace,
} from "@/lib/api";

export function MemoryViewer() {
  const [orgs, setOrgs] = useState<OrgMembership[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [scope, setScope] = useState<string>("org.brand");
  const [records, setRecords] = useState<ApiMemoryRecord[]>([]);
  const [newContent, setNewContent] = useState("");
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
      const res = await listWorkspaceMemory(workspaceId, {
        scope: scope.trim() || undefined,
        limit: 50,
      });
      setRecords(res.records);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [workspaceId, scope]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onCreate() {
    if (!workspaceId || !newContent.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createWorkspaceMemory(workspaceId, {
        scope: scope.trim() || "org.brand",
        content: newContent.trim(),
        pinned: true,
      });
      setNewContent("");
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onPin(id: string) {
    if (!workspaceId) return;
    setBusy(true);
    try {
      await pinWorkspaceMemory(workspaceId, id);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onForget(id: string) {
    if (!workspaceId) return;
    setBusy(true);
    try {
      await forgetWorkspaceMemory(workspaceId, id);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: "56rem",
        margin: "0 auto",
        padding: "2rem 1.25rem 4rem",
        fontFamily: "var(--font-body)",
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
        <a href="/memory" style={{ color: "var(--accent)", fontSize: "0.9rem" }}>
          Memory
        </a>
        <a href="/grants" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Grants
        </a>
        <a href="/packages" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Packages
        </a>
      </nav>

      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2rem", margin: "0 0 0.5rem" }}>
        Memory
      </h1>
      <p style={{ color: "var(--text-muted)", margin: "0 0 1.5rem", lineHeight: 1.5 }}>
        L1/L2 consultation + admin CRUD pour les faits L4 (<code>org.brand</code>). Les agents
        accèdent uniquement via Kernel.memory.
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
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.85rem" }}>
          Scope
          <input
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            placeholder="org.brand"
            style={{ minWidth: "10rem", padding: "0.4rem" }}
          />
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

      <div
        style={{
          display: "grid",
          gap: "0.5rem",
          marginBottom: "1.5rem",
          padding: "1rem 0",
          borderTop: "1px solid var(--border)",
        }}
      >
        <label style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
          Nouveau fait brand (admin)
        </label>
        <textarea
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          rows={3}
          placeholder="Tone of voice = premium, vouvoiement, jamais d'emojis."
          style={{ width: "100%", padding: "0.5rem", fontFamily: "inherit" }}
        />
        <button
          type="button"
          onClick={() => void onCreate()}
          disabled={busy || !workspaceId || !newContent.trim()}
          style={{
            justifySelf: "start",
            padding: "0.45rem 0.9rem",
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            cursor: "pointer",
          }}
        >
          Créer + pin
        </button>
      </div>

      {error ? (
        <p style={{ color: "crimson", marginBottom: "1rem" }} role="alert">
          {error}
        </p>
      ) : null}

      {records.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>Aucun record pour ce filtre.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gap: "0.75rem" }}>
          {records.map((r) => (
            <li
              key={r.id}
              style={{
                borderTop: "1px solid var(--border)",
                paddingTop: "0.75rem",
                fontSize: "0.9rem",
              }}
            >
              <div style={{ color: "var(--text-muted)", marginBottom: "0.35rem" }}>
                <code>{r.scope}</code> · {r.layer} · {r.type}
                {r.pinned ? " · pinned" : ""}
                {r.agent_id ? ` · ${r.agent_id}` : ""}
              </div>
              <pre
                style={{
                  margin: "0 0 0.5rem",
                  whiteSpace: "pre-wrap",
                  fontFamily: "var(--font-mono, ui-monospace, monospace)",
                  fontSize: "0.85rem",
                }}
              >
                {r.content}
              </pre>
              <div style={{ display: "flex", gap: "0.75rem" }}>
                <button type="button" onClick={() => void onPin(r.id)} disabled={busy || r.pinned}>
                  Pin
                </button>
                <button type="button" onClick={() => void onForget(r.id)} disabled={busy}>
                  Forget
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
