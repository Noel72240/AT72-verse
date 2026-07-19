# apps/api

NestJS API gateway for AT72 Verse.

## Phase 05 — Auth

| Method | Path | Auth |
|--------|------|------|
| `GET` | `/health` | public |
| `GET` | `/health/core` | public — Verse Core structured health (Phase 08) |
| `GET` | `/me` | AuthGuard |
| `POST` | `/auth/dev/login` | public, **dev only** |
| `POST` | `/auth/logout` | bearer |
| `POST` | `/webhooks/clerk` | stub |

## Phase 06 — Tenancy / RBAC

| Method | Path | Auth / RBAC |
|--------|------|-------------|
| `POST` | `/organizations` | AuthGuard (creator → OWNER + workspace `default`) |
| `GET` | `/organizations` | AuthGuard (memberships only) |
| `POST` | `/organizations/:orgId/invitations` | AuthGuard + org `ADMIN+` |
| `POST` | `/invitations/:token/accept` | AuthGuard (email must match) |
| `POST` | `/organizations/:orgId/workspaces` | AuthGuard + org `EDITOR+` |
| `GET` | `/organizations/:orgId/workspaces` | AuthGuard + org `VIEWER+` |
| `GET` | `/workspaces/:workspaceId` | AuthGuard + workspace member |

Pipeline: **Controller → AuthGuard → RbacGuard → Service → Prisma**.

Permissions live only in `RbacService` (never in controllers).

## Phase 08 — Verse Core (embedded)

- API depends only on `@at72-verse/verse-core` public façade (ADR-001 / Decision J1).
- `GET /health/core` → `VerseCore.health()` (modules, adapters, backend, version, uptime).
- Kernel backend via `VERSE_KERNEL_BACKEND=stub|core` (default `stub`); agents never see it.
- Bus (Phase 10): `createBusFromEnv()` wired into Core — Redis only inside `@at72-verse/bus`.

## Phase 11 — Runs

| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/workspaces/:workspaceId/conversations` | EDITOR+ |
| `GET` | `/conversations/:id` | member |
| `POST` | `/conversations/:id/messages` | EDITOR+ |
| `POST` | `/workspaces/:workspaceId/runs` | EDITOR+ · bootstrap step · optional `target_agent` (Phase 12) |
| `GET` | `/runs/:id` · `/runs/:id/steps` | VIEWER+ |
| `POST` | `/runs/:id/steps` | EDITOR+ |
| `PATCH` | `/runs/:id/status` | **technical** status transitions |

See `docs/runs.md`.

## Run

```bash
cp .env.example .env
pnpm docker:up
pnpm db:migrate
AUTH_PROVIDER=dev pnpm --filter @at72-verse/api start
```

Default port: `3001` (`API_PORT`).
