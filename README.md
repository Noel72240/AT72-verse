# AT72 Verse

Plateforme SaaS multi-agents pour entreprises.

Documentation :

- [Vision](docs/VISION.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [Décisions / ADR](docs/DECISIONS.md)
- [Changelog](docs/CHANGELOG.md)

## Prérequis

- Node.js **22** (voir `.nvmrc`)
- [pnpm](https://pnpm.io) **9.15.0** (`packageManager` field)

```bash
npm install -g pnpm@9.15.0
# ou: corepack enable && corepack prepare pnpm@9.15.0 --activate
```

## Installation

```bash
pnpm install
```

## Local data plane (Phase 03)

Requires [Docker](https://docs.docker.com/get-docker/) on the host.

```bash
cp .env.example .env   # optional overrides
pnpm docker:up         # Postgres + Redis
pnpm docker:ps         # wait until healthy
pnpm docker:check      # TCP reachability from host
pnpm docker:up:minio   # optional object storage
pnpm docker:down
```

See [`docs/runbooks/local-dev.md`](docs/runbooks/local-dev.md).

## Database (Phase 04)

```bash
pnpm db:generate   # Prisma client
pnpm db:migrate    # apply migrations
pnpm db:seed       # minimal Acme org/user/workspace
pnpm db:studio     # optional GUI
```

## Auth API (Phase 05)

```bash
AUTH_PROVIDER=dev pnpm api:start   # http://localhost:3001
# POST /auth/dev/login → GET /me → POST /auth/logout
```

`AUTH_PROVIDER=clerk` requires `CLERK_SECRET_KEY` (no Next.js in this phase).

## Scripts (Phase 01+)

| Commande | Description |
|----------|-------------|
| `pnpm dev` | No-op bootstrap (processus applicatifs en phases ultérieures) |
| `pnpm lint` | ESLint sur tous les workspaces |
| `pnpm typecheck` | `tsc --noEmit` via Turborepo |
| `pnpm test` | Tests workspaces (contrats + db + auth + api) |
| `pnpm format` | Prettier write |
| `pnpm format:check` | Prettier check (CI) |
| `pnpm ci` | lint + typecheck + test + format:check |

## Structure

Monorepo conforme à `docs/ARCHITECTURE.md` §10 : `apps/`, `packages/`, `agents/`, `skills/`, `tools/`, `personas/`, `prompts/`, `workflows/`, `infra/`, `docs/`.

## Statut

**Jalon J0 atteint.** Phase 07 (Kernel stub) livrée — en attente validation. Phase 08 non démarrée.
