"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  createOrganization,
  getStoredOrgId,
  getStoredWorkspaceId,
  getToken,
  listOrganizations,
  listWorkspaces,
  previewWorkspacePersona,
  saveWorkspacePersona,
  setStoredOrgId,
  setStoredWorkspaceId,
  setToken,
  type OrgMembership,
  type ResolvedPersonaPreview,
  type Workspace,
} from "@/lib/api";

const AGENTS = [
  { id: "nova", label: "Nova" },
  { id: "orion", label: "Orion" },
  { id: "astra", label: "Astra" },
  { id: "pixel", label: "Pixel" },
] as const;

export function PersonaEditor() {
  const [orgs, setOrgs] = useState<OrgMembership[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<string>("nova");
  const [formality, setFormality] = useState<"tutoiement" | "vouvoiement">("tutoiement");
  const [rulesText, setRulesText] = useState("");
  const [preview, setPreview] = useState<ResolvedPersonaPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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

  const loadPreview = useCallback(async () => {
    if (!workspaceId) return;
    setBusy(true);
    setError(null);
    try {
      const resolved = await previewWorkspacePersona(workspaceId, agentId);
      setPreview(resolved);
      const f = resolved.spec.tone?.formality;
      if (f === "vouvoiement" || f === "tutoiement") {
        setFormality(f);
      }
      const rules = resolved.spec.rules ?? [];
      setRulesText(rules.map((r) => r.text).join("\n"));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [workspaceId, agentId]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  async function onSave() {
    if (!workspaceId) return;
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const lines = rulesText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      await saveWorkspacePersona(workspaceId, agentId, {
        tone: { formality },
        rules: lines.map((text, i) => ({
          id: `workspace-rule-${i + 1}`,
          severity: "should" as const,
          text,
        })),
      });
      await loadPreview();
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function logout() {
    setToken(null);
    window.location.href = "/login";
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          AT72 <span>Verse</span>
        </div>
        <a href="/chat" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Chat
        </a>
        <a href="/workflows" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Workflows
        </a>
        <a href="/persona" style={{ color: "var(--accent)", fontSize: "0.9rem" }}>
          Persona
        </a>
        <a href="/memory" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Memory
        </a>
        <a href="/grants" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Grants
        </a>
        <a href="/packages" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Packages
        </a>
        <label>
          Org{" "}
          <select
            value={orgId ?? ""}
            onChange={(e) => {
              const id = e.target.value;
              setOrgId(id);
              setStoredOrgId(id);
              setStoredWorkspaceId(null);
            }}
          >
            {orgs.map((o) => (
              <option key={o.organization.id} value={o.organization.id}>
                {o.organization.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Workspace{" "}
          <select
            value={workspaceId ?? ""}
            onChange={(e) => {
              const id = e.target.value;
              setWorkspaceId(id);
              setStoredWorkspaceId(id);
            }}
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
          onClick={logout}
          style={{
            marginLeft: "auto",
            background: "transparent",
            border: "1px solid var(--border)",
            color: "var(--text-muted)",
            borderRadius: "var(--radius)",
            padding: "0.35rem 0.65rem",
          }}
        >
          Log out
        </button>
      </header>

      {error ? (
        <div className="error" style={{ padding: "0.5rem 1.25rem" }}>
          {error}
        </div>
      ) : null}

      <main
        style={{
          maxWidth: 720,
          margin: "0 auto",
          padding: "1.5rem 1.25rem",
          width: "100%",
        }}
      >
        <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: "0 0 0.35rem" }}>
          Workspace persona
        </h1>
        <p style={{ color: "var(--text-muted)", margin: "0 0 1.25rem", fontSize: "0.95rem" }}>
          Override formality and rules without redeploying agents.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            Agent
            <select
              value={agentId}
              onChange={(e) => setAgentId(e.target.value)}
              style={{
                background: "var(--bg-input)",
                color: "var(--text)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "0.45rem 0.55rem",
                maxWidth: 240,
              }}
            >
              {AGENTS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            Formality
            <select
              value={formality}
              onChange={(e) =>
                setFormality(e.target.value as "tutoiement" | "vouvoiement")
              }
              style={{
                background: "var(--bg-input)",
                color: "var(--text)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "0.45rem 0.55rem",
                maxWidth: 240,
              }}
            >
              <option value="tutoiement">Tutoiement</option>
              <option value="vouvoiement">Vouvoiement</option>
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            Rules (one per line)
            <textarea
              value={rulesText}
              onChange={(e) => setRulesText(e.target.value)}
              rows={5}
              style={{
                background: "var(--bg-input)",
                color: "var(--text)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "0.55rem 0.65rem",
                resize: "vertical",
                fontFamily: "var(--font-mono)",
                fontSize: "0.85rem",
              }}
            />
          </label>

          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <button
              type="button"
              disabled={busy || !workspaceId}
              onClick={() => void onSave()}
              style={{
                background: "var(--accent-dim)",
                color: "var(--text)",
                border: "1px solid var(--accent)",
                borderRadius: "var(--radius)",
                padding: "0.45rem 0.9rem",
              }}
            >
              {busy ? "Saving…" : "Save"}
            </button>
            {saved ? (
              <span style={{ color: "var(--accent)", fontSize: "0.9rem" }}>Saved</span>
            ) : null}
          </div>

          <div>
            <h2 style={{ fontSize: "0.95rem", fontWeight: 500, margin: "0.5rem 0" }}>
              ResolvedPersona preview
            </h2>
            <pre
              style={{
                background: "var(--bg-elevated)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
                padding: "0.75rem",
                overflow: "auto",
                fontSize: "0.75rem",
                fontFamily: "var(--font-mono)",
                maxHeight: 360,
              }}
            >
              {preview ? JSON.stringify(preview, null, 2) : "—"}
            </pre>
          </div>
        </div>
      </main>
    </div>
  );
}
