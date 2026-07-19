# Local data plane (Docker Compose)

PostgreSQL, Redis, and optional MinIO for AT72 Verse local development (Phase 03).

## Quick start

From the repository root:

```bash
# Copy env defaults if needed
cp .env.example .env

# Start core stack (Postgres + Redis)
pnpm docker:up

# Optional object storage
pnpm docker:up:minio

# Status / stop
pnpm docker:ps
pnpm docker:down
```

See `docs/runbooks/local-dev.md` for full instructions and connectivity checks.
