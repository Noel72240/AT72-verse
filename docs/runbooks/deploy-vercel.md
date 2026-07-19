# Runbook: deploy web on Vercel (monorepo)

## Scope

- **In scope:** `@at72-verse/web` (Next.js) on Vercel.
- **Out of scope:** `@at72-verse/api` (NestJS long-running + Postgres/Redis/SSE) — use Railway / Fly / Render / Cloud Run / K8s, not Vercel Functions.

## Preconditions

- Repo pushed: https://github.com/Noel72240/AT72-verse
- Node **22** on Vercel (matches root `engines` / `.nvmrc`)
- Optional: public API URL already deployed (for a working login/chat)

## Vercel project settings

1. **Import** GitHub repo `Noel72240/AT72-verse`
2. **Root Directory** → `apps/web`
3. Framework → Next.js (auto)
4. Leave Install / Build to `apps/web/vercel.json`:
   - Install: `cd ../.. && pnpm install --frozen-lockfile`
   - Build: `cd ../.. && pnpm --filter @at72-verse/web build`

## Environment variables (Production)

| Name | Example | Required |
|------|---------|----------|
| `NEXT_PUBLIC_API_URL` | `https://api.example.com` | Yes for live API calls |
| `VERSE_CSP_REPORT_ENABLED` | `0` | Optional (silence CSP reports in early deploy) |
| `NEXT_PUBLIC_CSP_REPORT_URI` | `https://api.example.com/csp-report` | Optional |

Set `NEXT_PUBLIC_*` **before** the first production build (baked at build time).

## API CORS

When the API is deployed, set:

```bash
WEB_ORIGIN=https://<your-vercel-domain>
```

so Nest CORS accepts the Vercel origin (`apps/api` reads `WEB_ORIGIN` / `NEXT_PUBLIC_WEB_ORIGIN`).

## Verify

1. Deploy succeeds (build log shows pnpm filter `@at72-verse/web`).
2. Open `https://<project>.vercel.app/login`.
3. With API up: login + org list work; without API: UI loads, API calls fail (expected).

## Do not

- Point Root Directory at `apps/api` for this project.
- Expect Nest/SSE/Redis to run as a Vercel serverless function without a dedicated adapter (not prepared).
