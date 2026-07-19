# packages/db

Prisma schema, migrations, client, and tenancy CRUD helpers (**Phase 04**).

## Models (tenancy v0)

| Table               | Notes                                                              |
| ------------------- | ------------------------------------------------------------------ |
| `organizations`     | Billing tenant (ARCHITECTURE §23)                                  |
| `users`             | Global identity; optional `clerk_user_id` (ADR-004)                |
| `memberships`       | User ↔ org + `OrgRole`                                             |
| `workspaces`        | Always scoped by `organization_id`                                 |
| `workspace_members` | User ↔ workspace + `WorkspaceRole`; denormalized `organization_id` |

Roles (`OWNER` / `ADMIN` / `EDITOR` / `VIEWER`) match Phase 06 product roles.

PostgreSQL RLS is **deferred** (app-level `organization_id` filtering first; RLS later if needed).

## Commands

From repo root (requires `DATABASE_URL`, typically via `.env` + `pnpm docker:up`):

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm --filter @at72-verse/db test
```

Or from this package:

```bash
pnpm --filter @at72-verse/db migrate:deploy
pnpm --filter @at72-verse/db seed
```

## Boundary

Agents must **not** import `@at72-verse/db` / Prisma. Access goes through Verse Core / API domain services only.
