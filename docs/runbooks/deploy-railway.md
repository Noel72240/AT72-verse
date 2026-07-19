# Runbook: deploy API (Railway) + wire Neon / Upstash / OpenAI

## Scope

- **API** Nest (`apps/api`) on Railway via `infra/docker/Dockerfile.api`
- **Web** stays on Vercel (`apps/web`)
- Secrets live in Railway / Vercel env — never in Git

## Preconditions

- GitHub repo pushed with `railway.toml` + `Dockerfile.api`
- Local file `verse-secrets.txt` with:
  - `DATABASE_URL` (Neon)
  - `REDIS_URL` (Upstash, prefer `rediss://`)
  - `OPENAI_API_KEY`

## Railway — create service

1. Open https://railway.app → Sign up with GitHub
2. **New Project** → **Deploy from GitHub repo** → `AT72-verse`
3. If asked for root: leave **repository root** (not `apps/api`)
4. Railway should pick `railway.toml` → Dockerfile API

## Railway — Variables (Settings → Variables)

Paste from your secrets file (values only on Railway):

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | Neon URI (`sslmode=require`) |
| `REDIS_URL` | Upstash `rediss://…` |
| `OPENAI_API_KEY` | `sk-…` |
| `AUTH_PROVIDER` | `dev` (MVP ; Clerk later) |
| `VERSE_KERNEL_BACKEND` | `core` |
| `WEB_ORIGIN` | `https://at-72-verse-web.vercel.app` |
| `PAYMENT_PROVIDER` | `sumup` |
| `VERSE_PAYMENT_STUB` | `1` (until SumUp live keys) |

Railway sets `PORT` automatically — the API already reads `PORT`.

## After first deploy

1. Open the public URL Railway gives you (Settings → Networking → Generate Domain)
2. Test: `https://<railway-domain>/health`
3. On **Vercel** project `at-72-verse-web` → Environment Variables:
   - `NEXT_PUBLIC_API_URL` = `https://<railway-domain>`
4. **Redeploy** the Vercel project (required for `NEXT_PUBLIC_*`)

## Login note

With `AUTH_PROVIDER=dev`, the Vercel login page uses DevAuth against your Railway API — same as local demo.

## Troubleshooting

- Build fails on pnpm → ensure latest commit with Dockerfile is on `master`
- Migrate fails on `vector` → Neon SQL Editor → `CREATE EXTENSION IF NOT EXISTS vector;`
- CORS errors → check `WEB_ORIGIN` matches the exact Vercel URL (https, no trailing slash)
