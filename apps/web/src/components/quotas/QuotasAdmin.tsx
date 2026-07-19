/**
 * Organization quotas admin (Phase 31 / EB7).
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  createOrganization,
  getOrganizationQuotas,
  getStoredOrgId,
  getToken,
  listOrganizations,
  putOrganizationQuotas,
  setStoredOrgId,
  type ApiOrgQuotaStatus,
  type OrgMembership,
} from "@/lib/api";

function formatQuotaError(e: unknown): string {
  if (e instanceof ApiError && e.body && typeof e.body === "object") {
    const body = e.body as Record<string, unknown>;
    if (body.code === "QUOTA_EXCEEDED" || body.code === "RATE_LIMITED") {
      const hint = typeof body.upgrade_hint === "string" ? ` — ${body.upgrade_hint}` : "";
      return `${String(body.message ?? e.message)}${hint}`;
    }
  }
  return e instanceof Error ? e.message : String(e);
}

export function QuotasAdmin() {
  const [orgs, setOrgs] = useState<OrgMembership[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [status, setStatus] = useState<ApiOrgQuotaStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [planId, setPlanId] = useState("free");
  const [runs, setRuns] = useState("");
  const [tokens, setTokens] = useState("");
  const [agents, setAgents] = useState("");
  const [rpm, setRpm] = useState("");
  const [reason, setReason] = useState("");

  const membership = orgs.find((o) => o.organization.id === orgId);
  const isOwner = membership?.role === "OWNER";

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

  const load = useCallback(async () => {
    if (!orgId) return;
    setBusy(true);
    setError(null);
    try {
      const res = await getOrganizationQuotas(orgId);
      setStatus(res);
      setPlanId(res.limits.plan_id);
      setRuns(String(res.limits.runs_per_month));
      setTokens(String(res.limits.tokens_per_month));
      setAgents(String(res.limits.max_agents_installed));
      setRpm(String(res.limits.api_rpm));
    } catch (e) {
      setError(formatQuotaError(e));
    } finally {
      setBusy(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveOverrides() {
    if (!orgId || !isOwner) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await putOrganizationQuotas(orgId, {
        plan_id: planId,
        runs_per_month: Number(runs),
        tokens_per_month: Number(tokens),
        max_agents_installed: Number(agents),
        api_rpm: Number(rpm),
        reason: reason.trim() || null,
      });
      setNotice("Quotas updated (audit entry recorded).");
      setReason("");
      await load();
    } catch (e) {
      setError(formatQuotaError(e));
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
      <nav style={{ display: "flex", gap: "1.25rem", marginBottom: "2rem", flexWrap: "wrap" }}>
        <a href="/chat" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Chat
        </a>
        <a href="/packages" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Packages
        </a>
        <a href="/quotas" style={{ color: "var(--accent)", fontSize: "0.9rem" }}>
          Quotas
        </a>
        <a href="/approvals" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Approvals
        </a>
      </nav>

      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2rem", margin: "0 0 0.5rem" }}>
        Organization quotas
      </h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
        Technical plans and numeric limits (no unlimited). Reset:{" "}
        {status?.reset_at ?? "—"}
      </p>

      <label style={{ display: "block", marginBottom: "1rem" }}>
        Organization
        <select
          value={orgId ?? ""}
          onChange={(e) => {
            const id = e.target.value;
            setOrgId(id);
            setStoredOrgId(id);
          }}
          style={{ display: "block", marginTop: "0.35rem", width: "100%", maxWidth: "24rem" }}
        >
          {orgs.map((m) => (
            <option key={m.organization.id} value={m.organization.id}>
              {m.organization.name} ({m.role})
            </option>
          ))}
        </select>
      </label>

      {error ? (
        <p role="alert" style={{ color: "var(--danger, #c44)", marginBottom: "1rem" }}>
          {error}
        </p>
      ) : null}
      {notice ? (
        <p style={{ color: "var(--accent)", marginBottom: "1rem" }}>{notice}</p>
      ) : null}

      {status ? (
        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.15rem", marginBottom: "0.75rem" }}>Usage this month</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, lineHeight: 1.7 }}>
            <li>
              Runs: {status.usage.runs_this_month} / {status.limits.runs_per_month}
            </li>
            <li>
              Tokens: {status.usage.tokens_this_month} / {status.limits.tokens_per_month}
            </li>
            <li>
              Agents installed: {status.usage.agents_installed} /{" "}
              {status.limits.max_agents_installed}
            </li>
            <li>API RPM limit: {status.limits.api_rpm}</li>
            <li>Plan: {status.limits.plan_id}</li>
          </ul>
        </section>
      ) : null}

      {isOwner ? (
        <section>
          <h2 style={{ fontSize: "1.15rem", marginBottom: "0.75rem" }}>Owner overrides</h2>
          <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", marginBottom: "1rem" }}>
            All values must be positive integers. Changes are audited (actor, previous, new, UTC,
            reason).
          </p>
          <div
            style={{
              display: "grid",
              gap: "0.75rem",
              maxWidth: "24rem",
            }}
          >
            <label>
              Plan
              <select
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                style={{ display: "block", width: "100%", marginTop: "0.25rem" }}
              >
                <option value="free">free</option>
                <option value="pro">pro</option>
                <option value="enterprise">enterprise</option>
              </select>
            </label>
            <label>
              Runs / month
              <input
                value={runs}
                onChange={(e) => setRuns(e.target.value)}
                style={{ display: "block", width: "100%", marginTop: "0.25rem" }}
              />
            </label>
            <label>
              Tokens / month
              <input
                value={tokens}
                onChange={(e) => setTokens(e.target.value)}
                style={{ display: "block", width: "100%", marginTop: "0.25rem" }}
              />
            </label>
            <label>
              Max agents installed
              <input
                value={agents}
                onChange={(e) => setAgents(e.target.value)}
                style={{ display: "block", width: "100%", marginTop: "0.25rem" }}
              />
            </label>
            <label>
              API RPM
              <input
                value={rpm}
                onChange={(e) => setRpm(e.target.value)}
                style={{ display: "block", width: "100%", marginTop: "0.25rem" }}
              />
            </label>
            <label>
              Reason (optional)
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Why this change?"
                style={{ display: "block", width: "100%", marginTop: "0.25rem" }}
              />
            </label>
            <button type="button" disabled={busy} onClick={() => void saveOverrides()}>
              {busy ? "Saving…" : "Save quotas"}
            </button>
          </div>
        </section>
      ) : (
        <p style={{ color: "var(--text-muted)" }}>
          Only organization OWNER can override quotas. Ask an owner to upgrade the plan.
        </p>
      )}
    </div>
  );
}
