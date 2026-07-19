# Package Registry (Phase 22)

First-party catalogue, org installs, and version pins — without marketplace UI or dynamic code loading.

## Principles (DP1–DP14)

| Decision | Rule |
|----------|------|
| DP1 | One registry for `agent` \| `skill` \| `tool` (later `workflow` \| `prompt_pack`) |
| DP2 | Registry = **metadata only**; Runtime keeps static first-party code registries |
| DP3 | Registry ≠ Install ≠ Permissions (independent axes) |
| DP4 | Tables: `packages` · `package_versions` · `tenant_packages` (no workspace_packages) |
| DP5 | Install at **Organization**; enable at Workspace via Grants |
| DP6 | First-party seeds (`pkg.adam`, `pkg.nova`, …) |
| DP7 | Mandatory version pin (no floating `latest`) |
| DP8 | Catalog + org install / uninstall / pin APIs |
| DP9 | Uninstall Nova → no exec; Adam OK; delegation fails cleanly; Core untouched |
| DP10 | Registry seeds grants only; Permission Engine remains authz authority |
| DP11 | `Kernel.registry.*` = metadata read from catalog |
| DP12b | Minimal UI `/packages` (install / uninstall / pin) |
| DP13 | No marketplace UI, signatures, hot-reload, or third-party loaders |
| DP14 | Soft uninstall; never cascade-delete Runs / memory / audit |

## Flow

```
API createOrg/workspace
  → ensureFirstPartyPackageCatalog + ensureFirstPartyTenantPackages
  → seed capability_grants (DP10)
API createRun
  → assertAgentPackageInstalled
  → buildPackagesSnapshot (installed only)
  → stamp packages_snapshot on AgentTaskPayload
Runtime / OrchestrationHost
  → evaluateAgentRun (grants)
  → assertCapabilityInstalled (packages)
  → handleTask
Skills / Tools
  → install gate then Permission Engine
```

## Separation

| Axis | Meaning | Authority |
|------|---------|-----------|
| Registry | What exists (manifest + versions) | Package Registry |
| Install | What the org has available | `tenant_packages` |
| Permissions | What may execute in a workspace | Permission Engine + grants |

## Extensibility

Future dynamic / Marketplace loaders plug behind the same Package Registry metadata APIs without breaking `Kernel.registry.*` or Runtime install gates. Metadata ≠ executable code.

## Post-J12 constraints

- Marketplace must reuse this Package Registry as SoT for package metadata / versions / installs.
- Future dynamic loaders must not change public `Kernel.registry.*` APIs.
- Signatures, trust policies, and third-party packages enrich this model without restructuring it.
- `packages_snapshot` remains the freeze point for run reproducibility and replay.
