# Permissions matrix (Phase 20 / DN13)

Functional allow/deny cases. Automated by `permission-engine.test.ts`, `tool-runtime.test.ts`, and `runtime.test.ts`.

| # | Case | Expected | Primary reason(s) |
|---|------|----------|-------------------|
| 1 | Agent `adam` with grant enabled | **Allow** | — |
| 2 | Agent `adam` with grant disabled | **Deny** | `agent_disabled` |
| 3 | Agent run without `grants_snapshot` | **Deny** | `grants_snapshot_missing` |
| 4 | Skill `skill.writing` enabled | **Allow** | — |
| 5 | Skill `skill.writing` disabled | **Deny** | `skill_disabled` |
| 6 | Tool `web-search` under Persona ∩ allowlist ∩ grant | **Allow** | — |
| 7 | Tool `file-read-write` (side-effect) with seed disabled | **Deny** | `workspace_grant_disabled`, `side_effect_requires_explicit_grant` |
| 8 | Tool outside Persona tools | **Deny** | `persona_missing_tool` |
| 9 | Tool outside Agent allowlist | **Deny** | `agent_allowlist` |
| 10 | Disabled agent on Runtime bus task | **Deny before handleTask** | `agent_disabled` |

Additional coverage:

- `assertAllowed` → `KernelError` `FORBIDDEN` with `details.reasons`
- Snapshot build sorts grants deterministically (audit / replay)
- Tool Runtime audits `forbidden` status when allowlist empty
