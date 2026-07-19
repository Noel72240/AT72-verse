# Runs & RunSteps

**Phase 11** · Decisions **AA1–AH1**

## Domain rules

- **API services** are the only entry point to create or mutate runs (AE1).
- Run `id` and `created_at` are **immutable** after insert.
- Steps use explicit **`seq`** (execution order), independent of step `id`.
- `conversation_id` on a run is **nullable** (system / API / scheduled runs — AB2).
- `parent_step_id` is stored for future DAGs (AC2); Phase 11 does not execute DAG logic.

## Status transitions (AD1)

| From | Allowed next |
|------|----------------|
| `queued` | `running`, `failed` |
| `running` | `completed`, `failed` |
| `completed` | — (terminal) |
| `failed` | — (terminal) |

Enforced in `canTransitionRunStatus` (`@at72-verse/contracts`) and `PATCH /runs/:id/status` (technical demo endpoint — AF2).

## HTTP surface (AF2)

| Method | Path | RBAC | Notes |
|--------|------|------|-------|
| `POST` | `/workspaces/:workspaceId/conversations` | workspace `EDITOR+` | |
| `GET` | `/conversations/:conversationId` | workspace member via service | |
| `POST` | `/conversations/:conversationId/messages` | workspace `EDITOR+` via service | |
| `POST` | `/workspaces/:workspaceId/runs` | workspace `EDITOR+` | creates bootstrap step `seq=1` |
| `GET` | `/runs/:runId` | workspace `VIEWER+` | |
| `GET` | `/runs/:runId/steps` | workspace `VIEWER+` | ordered by `seq` |
| `POST` | `/runs/:runId/steps` | workspace `EDITOR+` | appends next `seq` |
| `PATCH` | `/runs/:runId/status` | workspace `EDITOR+` | **technical** status tool |

## Bus events (AG1)

Published via `@at72-verse/bus` after persistence (never Redis direct). Envelope **`run_id`** always equals the run’s id.

| Topic | When |
|-------|------|
| `verse.runs.created` | After run + bootstrap step commit |
| `verse.runs.status_changed` | After controlled status PATCH |
| `verse.runs.step_created` | After append step |

See also `docs/bus-topics.md`.
