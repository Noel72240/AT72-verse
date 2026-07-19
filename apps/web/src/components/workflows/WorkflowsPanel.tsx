"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  createOrganization,
  getStoredOrgId,
  getStoredWorkspaceId,
  getToken,
  getWorkflowRun,
  listOrganizations,
  listWorkflows,
  listWorkspaces,
  resumeWorkflowRun,
  setStoredOrgId,
  setStoredWorkspaceId,
  startWorkflow,
  type OrgMembership,
  type Workspace,
} from "@/lib/api";

type WorkflowDef = {
  id: string;
  version: string;
  display_name: string;
  description?: string;
};

type WorkflowRunView = {
  id: string;
  workflow_id: string;
  status: string;
  run_id: string;
  completed_step_ids: string[];
  cursor_step_id: string | null;
  error: Record<string, unknown> | null;
};

export function WorkflowsPanel() {
  const [orgs, setOrgs] = useState<OrgMembership[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [defs, setDefs] = useState<WorkflowDef[]>([]);
  const [brief, setBrief] = useState("Campagne article + SEO + visuel pour le lancement");
  const [run, setRun] = useState<WorkflowRunView | null>(null);
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
          await createOrganization("Demo Org", `demo-${Date.now().toString(36)}`);
          memberships = await listOrganizations();
        }
        setOrgs(memberships);
        const preferredOrg = getStoredOrgId() ?? memberships[0]?.organization.id ?? null;
        setOrgId(preferredOrg);
        if (preferredOrg) setStoredOrgId(preferredOrg);
        const wf = await listWorkflows();
        setDefs(wf.workflows);
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

  const refreshRun = useCallback(async (id: string) => {
    const res = await getWorkflowRun(id);
    setRun(res.workflow_run);
  }, []);

  async function onStart(workflowId: string) {
    if (!workspaceId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await startWorkflow(workspaceId, workflowId, { brief });
      setRun(res.workflow_run);
      // Poll a few times while Runtime advances
      for (let i = 0; i < 8; i++) {
        await new Promise((r) => setTimeout(r, 400));
        await refreshRun(res.workflow_run.id);
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function onResume() {
    if (!run) return;
    setBusy(true);
    setError(null);
    try {
      const res = await resumeWorkflowRun(run.id);
      setRun(res.workflow_run);
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 400));
        await refreshRun(run.id);
      }
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
      <nav style={{ display: "flex", gap: "1.25rem", marginBottom: "2rem", flexWrap: "wrap" }}>
        <a href="/chat" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Chat
        </a>
        <a href="/workflows" style={{ color: "var(--accent)", fontSize: "0.9rem" }}>
          Workflows
        </a>
        <a href="/persona" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
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
      </nav>

      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2rem", margin: "0 0 0.5rem" }}>
        Workflows
      </h1>
      <p style={{ color: "var(--text-muted)", margin: "0 0 1.5rem", lineHeight: 1.5 }}>
        Processus déclaratifs hors chat. Le moteur orchestre via{" "}
        <code>delegateMany</code> — sans logique métier.
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", marginBottom: "1rem" }}>
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
      </div>

      <label style={{ display: "block", fontSize: "0.85rem", marginBottom: "0.35rem" }}>
        Brief
      </label>
      <textarea
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
        rows={3}
        style={{ width: "100%", padding: "0.5rem", marginBottom: "1rem", fontFamily: "inherit" }}
      />

      {error ? (
        <p style={{ color: "crimson" }} role="alert">
          {error}
        </p>
      ) : null}

      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: "0.75rem" }}>
        {defs.map((d) => (
          <li
            key={d.id}
            style={{ borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}
          >
            <strong>{d.display_name}</strong>{" "}
            <span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>
              {d.id}@{d.version}
            </span>
            {d.description ? (
              <p style={{ margin: "0.35rem 0", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                {d.description}
              </p>
            ) : null}
            <button
              type="button"
              disabled={busy || !workspaceId}
              onClick={() => void onStart(d.id)}
              style={{
                padding: "0.4rem 0.85rem",
                background: "var(--accent)",
                color: "#fff",
                border: "none",
                cursor: "pointer",
              }}
            >
              {busy ? "…" : "Lancer"}
            </button>
          </li>
        ))}
      </ul>

      {run ? (
        <section style={{ marginTop: "2rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
          <h2 style={{ fontSize: "1.15rem" }}>Dernier run</h2>
          <p style={{ fontSize: "0.9rem", color: "var(--text-muted)" }}>
            status: <strong style={{ color: "var(--text)" }}>{run.status}</strong>
            <br />
            run: <code>{run.run_id}</code>
            <br />
            steps: {run.completed_step_ids.join(", ") || "—"}
            {run.cursor_step_id ? (
              <>
                <br />
                cursor: <code>{run.cursor_step_id}</code>
              </>
            ) : null}
          </p>
          {run.status === "waiting_checkpoint" || run.status === "paused" ? (
            <button type="button" disabled={busy} onClick={() => void onResume()}>
              Reprendre (checkpoint)
            </button>
          ) : null}
          {run.error ? (
            <pre style={{ color: "crimson", fontSize: "0.85rem" }}>
              {JSON.stringify(run.error, null, 2)}
            </pre>
          ) : null}
        </section>
      ) : null}
    </main>
  );
}
