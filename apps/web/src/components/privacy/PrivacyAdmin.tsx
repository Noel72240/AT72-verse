/**
 * Organization privacy / GDPR (Phase 32).
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  createOrganization,
  getOrganizationAuditEvents,
  getStoredOrgId,
  getToken,
  listOrganizations,
  putOrganizationRetention,
  requestOrganizationExport,
  requestUserExport,
  restoreOrganization,
  setStoredOrgId,
  softDeleteMe,
  softDeleteOrganization,
  type OrgMembership,
} from "@/lib/api";

export function PrivacyAdmin() {
  const [orgs, setOrgs] = useState<OrgMembership[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [auditPreview, setAuditPreview] = useState<string>("");
  const [graceDays, setGraceDays] = useState("30");
  const [auditDays, setAuditDays] = useState("365");

  const membership = orgs.find((o) => o.organization.id === orgId);
  const isOwner = membership?.role === "OWNER";
  const isAdmin =
    membership?.role === "OWNER" || membership?.role === "ADMIN";

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
        const preferred = getStoredOrgId() ?? memberships[0]?.organization.id ?? null;
        setOrgId(preferred);
        if (preferred) setStoredOrgId(preferred);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  const loadAudit = useCallback(async () => {
    if (!orgId || !isAdmin) return;
    try {
      const res = await getOrganizationAuditEvents(orgId);
      setAuditPreview(
        res.events
          .slice(0, 20)
          .map((e) => `${e.created_at} ${e.action} ${e.resource_type}`)
          .join("\n"),
      );
    } catch (e) {
      if (e instanceof ApiError && e.status === 410) {
        setError("Organization soft-deleted (410 Gone)");
      }
    }
  }, [orgId, isAdmin]);

  useEffect(() => {
    void loadAudit();
  }, [loadAudit]);

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(label);
      const memberships = await listOrganizations();
      setOrgs(memberships);
      await loadAudit();
    } catch (e) {
      if (e instanceof ApiError && e.status === 410) {
        setError("410 Gone — resource soft-deleted");
      } else {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
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
        <a href="/quotas" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Quotas
        </a>
        <a href="/privacy" style={{ color: "var(--accent)", fontSize: "0.9rem" }}>
          Privacy
        </a>
      </nav>

      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2rem", margin: "0 0 0.5rem" }}>
        Privacy & data
      </h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
        Export, soft-delete, and audit (Phase 32). Org export includes conversation metadata only —
        full messages via personal export.
      </p>

      {error ? (
        <p role="alert" style={{ color: "var(--danger, #c44)" }}>
          {error}
        </p>
      ) : null}
      {notice ? <p style={{ color: "var(--accent)" }}>{notice}</p> : null}

      <section style={{ marginBottom: "2rem" }}>
        <h2 style={{ fontSize: "1.15rem" }}>Your account</h2>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void run("User export ready — download via API response / job", async () => {
                const res = await requestUserExport();
                const blob = new Blob([JSON.stringify(res.payload, null, 2)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `verse-export-user-${res.job.id}.json`;
                a.click();
                URL.revokeObjectURL(url);
              })
            }
          >
            Export my data
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (!confirm("Soft-delete your account? You can restore within the grace period.")) {
                return;
              }
              void run("Account soft-deleted", () => softDeleteMe());
            }}
          >
            Soft-delete my account
          </button>
        </div>
      </section>

      <label style={{ display: "block", marginBottom: "1rem" }}>
        Organization
        <select
          value={orgId ?? ""}
          onChange={(e) => {
            setOrgId(e.target.value);
            setStoredOrgId(e.target.value);
          }}
          style={{ display: "block", marginTop: "0.35rem", width: "100%", maxWidth: "24rem" }}
        >
          {orgs.map((m) => (
            <option key={m.organization.id} value={m.organization.id}>
              {m.organization.name} ({m.role})
              {m.organization.deletedAt || m.organization.deleted_at ? " — soft-deleted" : ""}
            </option>
          ))}
        </select>
      </label>

      {isOwner ? (
        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.15rem" }}>Owner controls</h2>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "0.75rem" }}>
            <button
              type="button"
              disabled={busy || !orgId}
              onClick={() =>
                void run("Org export ready", async () => {
                  if (!orgId) return;
                  const res = await requestOrganizationExport(orgId);
                  const blob = new Blob([JSON.stringify(res.payload, null, 2)], {
                    type: "application/json",
                  });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `verse-export-org-${res.job.id}.json`;
                  a.click();
                  URL.revokeObjectURL(url);
                })
              }
            >
              Export organization
            </button>
            <button
              type="button"
              disabled={busy || !orgId}
              onClick={() => {
                if (!orgId) return;
                if (!confirm("Soft-delete this organization?")) return;
                void run("Organization soft-deleted", () => softDeleteOrganization(orgId));
              }}
            >
              Soft-delete organization
            </button>
            <button
              type="button"
              disabled={busy || !orgId}
              onClick={() => {
                if (!orgId) return;
                void run("Organization restored", () => restoreOrganization(orgId));
              }}
            >
              Restore organization
            </button>
          </div>
          <div style={{ marginTop: "1rem", display: "grid", gap: "0.5rem", maxWidth: "20rem" }}>
            <label>
              Soft-delete grace (days)
              <input value={graceDays} onChange={(e) => setGraceDays(e.target.value)} />
            </label>
            <label>
              Audit retention (days, min 365)
              <input value={auditDays} onChange={(e) => setAuditDays(e.target.value)} />
            </label>
            <button
              type="button"
              disabled={busy || !orgId}
              onClick={() => {
                if (!orgId) return;
                void run("Retention updated", () =>
                  putOrganizationRetention(orgId, {
                    soft_delete_grace_days: Number(graceDays),
                    audit_retention_days: Number(auditDays),
                  }),
                );
              }}
            >
              Save retention
            </button>
          </div>
        </section>
      ) : null}

      {isAdmin ? (
        <section>
          <h2 style={{ fontSize: "1.15rem" }}>Recent audit events</h2>
          <pre
            style={{
              background: "var(--surface, #111)",
              padding: "1rem",
              overflow: "auto",
              fontSize: "0.8rem",
            }}
          >
            {auditPreview || "(none)"}
          </pre>
        </section>
      ) : null}
    </div>
  );
}
