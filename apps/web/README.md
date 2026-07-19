# AT72 Verse Web (Phase 16)

Official Verse UI — Next.js 15 App Router.

## Dev

```bash
# terminal 1 — API (+ Postgres)
AUTH_PROVIDER=dev pnpm api:start

# terminal 2 — agent runtime (optional for live Adam→Nova)
pnpm runtime:start

# terminal 3 — web
pnpm web:dev
```

Open http://localhost:3000 — DevAuth login, pick workspace, chat with Adam.

## Boundaries

- HTTP to Nest API only
- Never imports Core, Runtime, agents, or Prisma

## Env

| Variable | Default |
|----------|---------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` |
