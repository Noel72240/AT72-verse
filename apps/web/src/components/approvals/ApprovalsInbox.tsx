"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  approveRunApproval,
  createOrganization,
  getStoredOrgId,
  getStoredWorkspaceId,
  getToken,
  listOrganizations,
  listWorkspaceApprovals,
  listWorkspaces,
  rejectRunApproval,
  setStoredOrgId,
  setStoredWorkspaceId,
  type ApiApprovalRequest,
  type OrgMembership,
  type Workspace,
} from "@/lib/api";

export function ApprovalsInbox() {
  const [orgs, setOrgs] = useState<OrgMembership[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [approvals, setApprovals] = useState<ApiApprovalRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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
      const res = await listWorkspaceApprovals(workspaceId, "pending");
      setApprovals(res.approvals);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onApprove(row: ApiApprovalRequest) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await approveRunApproval(row.run_id, row.id);
      setNotice(`Approved ${row.tool_id}`);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  async function onReject(row: ApiApprovalRequest) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await rejectRunApproval(row.run_id, row.id);
      setNotice(`Rejected ${row.tool_id}`);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <main style={{ maxWidth: 720, margin: "2rem auto", padding: "0 1rem" }}>
      <nav style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
        <a href="/chat" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Chat
        </a>
        <a href="/grants" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Grants
        </a>
        <a href="/connectors" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Connectors
        </a>
        <a href="/approvals" style={{ color: "var(--accent)", fontSize: "0.9rem" }}>
          Approvals
        </a>
      </nav>

      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>Approvals</h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
        Phase 29 HITL — approve or reject live side-effects before they run. ADMIN / OWNER only for
        decisions.
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
        <button type="button" disabled={busy || !workspaceId} onClick={() => void load()}>
          {busy ? "…" : "Refresh"}
        </button>
      </div>

      {error ? <p style={{ color: "var(--danger, #c44)" }}>{error}</p> : null}
      {notice ? <p style={{ color: "var(--accent)" }}>{notice}</p> : null}

      {approvals.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>No pending approvals.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {approvals.map((a) => (
            <li
              key={a.id}
              style={{
                padding: "1rem 0",
                borderBottom: "1px solid var(--border, #333)",
              }}
            >
              <div style={{ fontFamily: "var(--font-ibm-mono), monospace", fontSize: "0.95rem" }}>
                {a.tool_id} · {a.agent_id}
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: "0.85rem", marginTop: "0.35rem" }}>
                {a.input_preview.platform ?? "—"} · {a.input_preview.mode ?? "—"}
                {a.input_preview.content_preview
                  ? ` · ${a.input_preview.content_preview}`
                  : ""}
              </div>
              <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: "0.25rem" }}>
                expires {a.expires_at}
              </div>
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem" }}>
                <button type="button" disabled={busy} onClick={() => void onApprove(a)}>
                  Approve
                </button>
                <button type="button" disabled={busy} onClick={() => void onReject(a)}>
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
