# Packages matrix (Phase 22 / DP14)

| # | Case | Expected |
|---|------|----------|
| 1 | Full first-party snapshot | adam / nova / orion / astra / pixel + skills/tools installed |
| 2 | Exclude `pkg.nova` | `assertCapabilityInstalled(nova)` → FORBIDDEN |
| 3 | Missing `packages_snapshot` | FORBIDDEN (`packages_snapshot_missing`) |
| 4 | Direct Nova task without install | Runtime fails before `handleTask` |
| 5 | Adam → Nova with Nova uninstalled | Delegation fails cleanly; Adam failed |
| 6 | Soft uninstall | `tenant_packages.status=uninstalled`; no Run/memory/audit delete |
| 7 | Reinstall | status back to `installed`; pin restored |
| 8 | Pin unknown version | rejected |
| 9 | Skill/tool without package | install gate before Permission Engine |
| 10 | `Kernel.registry.getAgent/Skill/Tool` | metadata from first-party catalog |
| 11 | Exclude `pkg.orion` | Orion refused before handleTask (P23) |
| 12 | Disable Orion grant | Orion refused (`agent_disabled`) |

Automated by `package-install-gate.test.ts`, Runtime DP9/DQ10 cases, API package routes.
