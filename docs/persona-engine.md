# Persona Engine (Phase 17 / ADR-010)

Configurable agent identity without redeploying agent packages.

## Architecture

| Layer | Source | Notes |
|-------|--------|--------|
| **system** | `SYSTEM_PERSONA_BASE` in Core | Platform defaults |
| **agent** | First-party seeds (`persona.{agent}.default`) | Versioned in repo + Core |
| **organization** | `persona_overrides` (`workspace_id` null) | DB patch |
| **workspace** | `persona_overrides` (workspace scoped) | DB patch — wins on conflict |

Merge is **deterministic** (`mergePersonaLayers`). Output is an immutable **`ResolvedPersona`** with provenance.

## Kernel

```ts
const resolved = await kernel.persona.resolve("nova");
// resolved.spec.tone.formality, resolved.spec.rules, resolved.provenance
```

Agents must not import Prisma or persona storage. Runtime stamps org/workspace patches on `AgentTaskPayload` (`persona_org_override` / `persona_workspace_override`) and feeds them via `runWithPersonaOverrides` + `createStampedPersonaOverridePort`.

## API

| Method | Path | Role |
|--------|------|------|
| `GET` | `/workspaces/:workspaceId/personas/:agentId` | VIEWER — preview `ResolvedPersona` |
| `PUT` | `/workspaces/:workspaceId/personas/:agentId` | EDITOR — body `{ patch }` |
| `GET` | `/organizations/:orgId/personas/:agentId` | VIEWER — override or org-only preview |
| `PUT` | `/organizations/:orgId/personas/:agentId` | EDITOR — body `{ patch }` |

API hosts Core with `createPrismaPersonaOverridePort` (set on `PersonaService.onModuleInit`).

## UI

`/persona` — workspace editor (agent, formality tutoiement/vouvoiement, rules textarea, JSON preview). Front → API only.

## Run debug

When an agent task completes, `resolved_persona` is included on `task.completed` and stored on the parent RunStep `output`.

## Seeds

- `packages/verse-core/src/persona/seeds/`
- Canonical copies under `/personas/*.json` — keep in sync
