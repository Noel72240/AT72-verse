# Permission Engine (Phase 20)

Capability-based authorization for Agents, Skills, and Tools.

## Principles (DN1–DN13)

| Decision | Rule |
|----------|------|
| DN1 | Permission Engine lives in Verse Core (platform service, like LLM / Persona / Memory / Tools) |
| DN2 | Generic `PermissionGrant` / `CapabilityKind` (`agent` \| `skill` \| `tool`) |
| DN3 | Table `capability_grants` = source of truth per workspace — never agent-local config |
| DN4 | Tools: `Persona ∩ Agent allowlist ∩ Workspace grant ∩ side-effect constraint` — `Kernel.tools.execute` API unchanged |
| DN5 | Deny by default for side-effect tools; read tools may be enabled via first-party seeds |
| DN6 | Runtime never invokes a skill disabled for the workspace |
| DN7 | Disabled agents refused **before** `handleTask()` |
| DN8 | `grants_snapshot` frozen at Run / task dispatch |
| DN9 | Permission Engine = single enforcement point (no duplicate checks in agents/skills) |
| DN10 | Admin UI: enable/disable only (fine ACL later) |
| DN11 | User RBAC ≠ agent capabilities (independent) |
| DN12 | Seeds: adam/nova/skill.writing/web-search **enabled**; file-read-write **disabled** |
| DN13 | Allow/deny matrix = functional proof — see [`permissions-matrix.md`](./permissions-matrix.md) |

## Flow

```
API createRun
  → assertAgentEnabled + buildCapabilityGrantSnapshot
  → stamp grants_snapshot on AgentTaskPayload
Runtime
  → evaluateAgentRun (before handleTask)
  → KernelContext.grants_snapshot
Core
  → skills.invoke → evaluateSkillInvoke
  → tools.execute → evaluateToolExecute
```

## Denial reasons

Every refusal exposes deterministic `reasons[]` (`AuthzDenialReason`):

- `grants_snapshot_missing`
- `workspace_grant_missing` / `workspace_grant_disabled`
- `agent_disabled` / `skill_disabled`
- `persona_missing_tool` / `agent_allowlist`
- `side_effect_requires_explicit_grant`
- `capability_not_registered` (reserved)

Thrown as `KernelError` `FORBIDDEN` with `details.reasons`.

## Extensibility

Future policies (Marketplace, OAuth, consent) plug into **PermissionEngine** internals without changing public Kernel APIs (`tools.execute`, `skills.invoke`, `orchestration.delegate`).

New Agents / Skills / Tools fit the model automatically via `(kind, capability_id)` — no special-case authz logic.

## Admin

- `GET /workspaces/:id/grants` (VIEWER)
- `PUT /workspaces/:id/grants` `{ kind, capability_id, enabled }` (EDITOR)
- Web UI `/grants`
