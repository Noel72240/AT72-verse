/**
 * Organization billing (Phase 34) — PaymentProvider-agnostic UI.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ApiError,
  cancelOrganizationBilling,
  createOrganization,
  getOrganizationBilling,
  getStoredOrgId,
  getToken,
  listOrganizationInvoices,
  listOrganizations,
  openOrganizationBillingPortal,
  setStoredOrgId,
  startOrganizationCheckout,
  type ApiBillingInvoice,
  type ApiOrgBilling,
  type OrgMembership,
} from "@/lib/api";

function formatBillingError(e: unknown): string {
  if (e instanceof ApiError && e.body && typeof e.body === "object") {
    const body = e.body as Record<string, unknown>;
    if (body.code === "PAYMENT_REQUIRED") {
      const hint = typeof body.upgrade_hint === "string" ? ` — ${body.upgrade_hint}` : "";
      return `${String(body.message ?? e.message)}${hint}`;
    }
  }
  return e instanceof Error ? e.message : String(e);
}

export function BillingAdmin() {
  const [orgs, setOrgs] = useState<OrgMembership[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [billing, setBilling] = useState<ApiOrgBilling | null>(null);
  const [invoices, setInvoices] = useState<ApiBillingInvoice[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const membership = orgs.find((o) => o.organization.id === orgId);
  const isOwner = membership?.role === "OWNER";
  const isAdmin = membership?.role === "OWNER" || membership?.role === "ADMIN";

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
    if (!orgId || !isAdmin) return;
    setBusy(true);
    setError(null);
    try {
      const status = await getOrganizationBilling(orgId);
      setBilling(status);
      if (isOwner) {
        const inv = await listOrganizationInvoices(orgId);
        setInvoices(inv.invoices);
      } else {
        setInvoices([]);
      }
    } catch (e) {
      setError(formatBillingError(e));
    } finally {
      setBusy(false);
    }
  }, [orgId, isAdmin, isOwner]);

  useEffect(() => {
    void load();
  }, [load]);

  async function checkout(plan: "pro" | "enterprise") {
    if (!orgId || !isOwner) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await startOrganizationCheckout(orgId, { target_plan: plan });
      setNotice(`Checkout ready (${plan}). Redirecting…`);
      window.location.href = res.checkout_url;
    } catch (e) {
      setError(formatBillingError(e));
      setBusy(false);
    }
  }

  async function openManage() {
    if (!orgId || !isOwner) return;
    setBusy(true);
    setError(null);
    try {
      const res = await openOrganizationBillingPortal(orgId, {
        return_url: `${window.location.origin}/billing`,
      });
      window.location.href = res.manage_url;
    } catch (e) {
      setError(formatBillingError(e));
      setBusy(false);
    }
  }

  async function cancelAtPeriodEnd() {
    if (!orgId || !isOwner) return;
    if (!window.confirm("Cancel subscription at period end?")) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const status = await cancelOrganizationBilling(orgId);
      setBilling(status);
      setNotice("Cancellation requested (end of period).");
    } catch (e) {
      setError(formatBillingError(e));
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
        <a href="/billing" style={{ color: "var(--accent)", fontSize: "0.9rem" }}>
          Billing
        </a>
        <a href="/privacy" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Privacy
        </a>
      </nav>

      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2rem", margin: "0 0 0.5rem" }}>
        Billing
      </h1>
      <p style={{ color: "var(--text-muted)", marginBottom: "1.5rem" }}>
        Subscription status for the organization (provider-agnostic). Soft-block applies when unpaid
        after grace.
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

      {billing ? (
        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.15rem", marginBottom: "0.75rem" }}>Status</h2>
          <dl style={{ display: "grid", gridTemplateColumns: "10rem 1fr", gap: "0.35rem 1rem" }}>
            <dt style={{ color: "var(--text-muted)" }}>Provider</dt>
            <dd style={{ margin: 0 }}>{billing.provider}</dd>
            <dt style={{ color: "var(--text-muted)" }}>Plan</dt>
            <dd style={{ margin: 0 }}>{billing.plan_id}</dd>
            <dt style={{ color: "var(--text-muted)" }}>Status</dt>
            <dd style={{ margin: 0 }}>{billing.status}</dd>
            <dt style={{ color: "var(--text-muted)" }}>Period end</dt>
            <dd style={{ margin: 0 }}>{billing.current_period_end ?? "—"}</dd>
            <dt style={{ color: "var(--text-muted)" }}>Grace until</dt>
            <dd style={{ margin: 0 }}>{billing.grace_until ?? "—"}</dd>
          </dl>
        </section>
      ) : null}

      {isOwner ? (
        <section style={{ marginBottom: "2rem" }}>
          <h2 style={{ fontSize: "1.15rem", marginBottom: "0.75rem" }}>Actions</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            <button type="button" disabled={busy} onClick={() => void checkout("pro")}>
              Upgrade to Pro
            </button>
            <button type="button" disabled={busy} onClick={() => void checkout("enterprise")}>
              Upgrade to Enterprise
            </button>
            <button type="button" disabled={busy} onClick={() => void openManage()}>
              Manage payment
            </button>
            <button type="button" disabled={busy} onClick={() => void cancelAtPeriodEnd()}>
              Cancel at period end
            </button>
          </div>
        </section>
      ) : (
        <p style={{ color: "var(--text-muted)" }}>
          Only organization OWNER can change billing. ADMIN can view status.
        </p>
      )}

      {isOwner && invoices.length > 0 ? (
        <section>
          <h2 style={{ fontSize: "1.15rem", marginBottom: "0.75rem" }}>Invoices</h2>
          <ul style={{ paddingLeft: "1.25rem" }}>
            {invoices.map((inv) => (
              <li key={inv.id}>
                {inv.created_at} — {(inv.amount_cents / 100).toFixed(2)} {inv.currency} (
                {inv.status})
                {inv.invoice_url ? (
                  <>
                    {" "}
                    <a href={inv.invoice_url} target="_blank" rel="noreferrer">
                      View
                    </a>
                  </>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
