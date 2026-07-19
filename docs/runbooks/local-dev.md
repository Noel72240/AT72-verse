# Runbook: local development (Phase 03)

## Purpose

Start and verify the local data plane: **PostgreSQL**, **Redis**, and optionally **MinIO**.

## Preconditions

- Docker Desktop (or Docker Engine + Compose v2) installed and running
- Node.js 22 + pnpm 9.15 (repo toolchain)
- Ports free on the host: `5432` (Postgres), `6379` (Redis); optionally `9000`/`9001` (MinIO)
- Repository cloned; run commands from the **repo root**

## Steps

### 1. Environment file

```bash
cp .env.example .env
```

Adjust ports in `.env` if they conflict on your machine.

### 2. Start core stack

```bash
pnpm docker:up
```

This runs:

`docker compose -f infra/docker/docker-compose.yml up -d postgres redis`

### 3. Wait for healthy

```bash
pnpm docker:ps
```

Expected: `postgres` and `redis` show **healthy** (typically under 2 minutes on a normal machine).

### 4. Connectivity checks (from host)

Quick TCP probe (no client tools required):

```bash
pnpm docker:check
```

**PostgreSQL**

```bash
docker exec at72-verse-postgres pg_isready -U verse -d verse
```

Or with a local client:

```bash
psql "postgresql://verse:verse@localhost:5432/verse" -c "SELECT 1;"
```

**Redis**

```bash
docker exec at72-verse-redis redis-cli ping
```

Expected: `PONG`.

### 5. Database migrations & seed (Phase 04+)

With Postgres healthy and `.env` containing `DATABASE_URL`:

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

Optional: `pnpm db:studio` for Prisma Studio.

### 6. Auth API smoke (Phase 05)

```bash
AUTH_PROVIDER=dev pnpm api:start
```

In another terminal:

```bash
curl -s -X POST http://localhost:3001/auth/dev/login \
  -H "content-type: application/json" \
  -d "{\"email\":\"you@example.com\",\"displayName\":\"You\"}"
# use accessToken:
curl -s http://localhost:3001/me -H "authorization: Bearer <token>"
curl -s -X POST http://localhost:3001/auth/logout -H "authorization: Bearer <token>"
```

### 7. Optional MinIO

```bash
pnpm docker:up:minio
```

- API: `http://localhost:9000`
- Console: `http://localhost:9001`
- Credentials: see `.env.example` (`MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`)

### 8. Stop

```bash
pnpm docker:down
```

Volumes persist by default (data retained across restarts). To wipe volumes:

```bash
pnpm docker:down:volumes
```

## Rollback

- `pnpm docker:down` stops containers without deleting images.
- `pnpm docker:down:volumes` removes named volumes (`at72_verse_*`) — **destructive** for local data.
- Re-pull images if corrupted: `docker compose -f infra/docker/docker-compose.yml pull`

## Contacts

- Platform / local env: engineering (AT72 Verse)
- Compose file: `infra/docker/docker-compose.yml`
- Env template: `.env.example`
