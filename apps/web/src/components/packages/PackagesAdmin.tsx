"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  createOrganization,
  getStoredOrgId,
  getToken,
  installOrganizationPackage,
  listCatalogPackages,
  listOrganizationPackages,
  listOrganizations,
  pinOrganizationPackage,
  setStoredOrgId,
  uninstallOrganizationPackage,
  type ApiCatalogPackage,
  type ApiTenantPackage,
  type OrgMembership,
} from "@/lib/api";

const KIND_ORDER: Record<string, number> = { agent: 0, skill: 1, tool: 2 };

export function PackagesAdmin() {
  const [orgs, setOrgs] = useState<OrgMembership[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<ApiCatalogPackage[]>([]);
  const [installs, setInstalls] = useState<ApiTenantPackage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pinDraft, setPinDraft] = useState<Record<string, string>>({});

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
      const [cat, orgPkgs] = await Promise.all([
        listCatalogPackages(),
        listOrganizationPackages(orgId),
      ]);
      const sorted = [...cat.packages].sort((a, b) => {
        const k = (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9);
        return k !== 0 ? k : a.package_id.localeCompare(b.package_id);
      });
      setCatalog(sorted);
      setInstalls(orgPkgs.installs);
      const drafts: Record<string, string> = {};
      for (const p of sorted) {
        const inst = orgPkgs.installs.find((i) => i.package_id === p.package_id);
        drafts[p.package_id] = inst?.pinned_version ?? p.latest_version;
      }
      setPinDraft(drafts);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [orgId]);

  useEffect(() => {
    void load();
  }, [load]);

  const installByPackageId = useMemo(() => {
    const map = new Map<string, ApiTenantPackage>();
    for (const i of installs) map.set(i.package_id, i);
    return map;
  }, [installs]);

  async function installPackage(pkg: ApiCatalogPackage) {
    if (!orgId) return;
    setBusy(true);
    setError(null);
    try {
      await installOrganizationPackage(orgId, {
        package_id: pkg.package_id,
        pinned_version: pinDraft[pkg.package_id] ?? pkg.latest_version,
      });
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  async function uninstallPackage(packageId: string) {
    if (!orgId) return;
    setBusy(true);
    setError(null);
    try {
      await uninstallOrganizationPackage(orgId, packageId);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  async function pinPackage(packageId: string) {
    if (!orgId) return;
    const version = pinDraft[packageId];
    if (!version) return;
    setBusy(true);
    setError(null);
    try {
      await pinOrganizationPackage(orgId, packageId, version);
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
      <nav style={{ display: "flex", gap: "1.25rem", marginBottom: "2rem", flexWrap: "wrap" }}>
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
        <a href="/grants" style={{ color: "var(--text-muted)", fontSize: "0.9rem" }}>
          Grants
        </a>
        <a href="/packages" style={{ color: "var(--accent)", fontSize: "0.9rem" }}>
          Packages
        </a>
      </nav>

      <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2rem", margin: "0 0 0.5rem" }}>
        Package registry
      </h1>
      <p style={{ color: "var(--text-muted)", margin: "0 0 1.5rem", lineHeight: 1.5 }}>
        Install / désinstalle / pin des packages first-party au niveau organisation. L’enable
        d’exécution reste sur Grants (Permission Engine).
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
        <button
          type="button"
          onClick={() => void load()}
          disabled={busy || !orgId}
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
        {catalog.map((pkg) => {
          const tenantPkg = installByPackageId.get(pkg.package_id);
          const installed = tenantPkg?.status === "installed";
          return (
            <li
              key={pkg.package_id}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5rem",
                padding: "0.85rem 0",
                borderBottom: "1px solid var(--border, #333)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  justifyContent: "space-between",
                  gap: "1rem",
                  flexWrap: "wrap",
                }}
              >
                <div>
                  <div style={{ fontFamily: "var(--font-ibm-mono), monospace", fontSize: "0.95rem" }}>
                    {pkg.package_id}
                  </div>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.8rem" }}>
                    {pkg.kind} · {pkg.capability_id} · {pkg.display_name}
                  </div>
                  <div style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: "0.2rem" }}>
                    {installed
                      ? `installed @ ${tenantPkg!.pinned_version}`
                      : tenantPkg
                        ? `uninstalled (was ${tenantPkg.pinned_version})`
                        : "not installed"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                  <select
                    value={pinDraft[pkg.package_id] ?? pkg.latest_version}
                    disabled={busy}
                    onChange={(e) =>
                      setPinDraft((prev) => ({ ...prev, [pkg.package_id]: e.target.value }))
                    }
                    style={{ padding: "0.35rem" }}
                  >
                    {pkg.versions.map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                  {installed ? (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void pinPackage(pkg.package_id)}
                        style={{
                          padding: "0.4rem 0.75rem",
                          border: "1px solid var(--border, #444)",
                          background: "transparent",
                          color: "var(--text)",
                          cursor: "pointer",
                        }}
                      >
                        Pin
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void uninstallPackage(pkg.package_id)}
                        style={{
                          padding: "0.4rem 0.75rem",
                          border: "1px solid var(--border, #444)",
                          background: "transparent",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                        }}
                      >
                        Uninstall
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void installPackage(pkg)}
                      style={{
                        padding: "0.4rem 0.75rem",
                        border: "none",
                        background: "var(--accent)",
                        color: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      Install
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
