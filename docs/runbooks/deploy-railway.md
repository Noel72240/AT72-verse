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
| `VERSE_LLM_MODEL_FAST` | optional — default `gpt-5.4-mini` (chat / vitesse) |
| `VERSE_LLM_MODEL_QUALITY` | optional — default `gpt-5.5` (posts / orchestration) |

Optional: `VERSE_EMBED_AGENT_RUNTIME=0` only if you deploy a **separate** `apps/agent-runtime` service. By default the API embeds Adam so chat runs complete on a single Railway service.

Railway sets `PORT` automatically — the API already reads `PORT`.

## After first deploy

1. Open the public URL Railway gives you (Settings → Networking → Generate Domain)
2. Test: `https://<railway-domain>/health`
3. On **Vercel** project `at-72-verse-web` → Environment Variables:
   - `NEXT_PUBLIC_API_URL` = `https://<railway-domain>`
4. **Redeploy** the Vercel project (required for `NEXT_PUBLIC_*`)

## Login note

With `AUTH_PROVIDER=dev`, the Vercel login page uses DevAuth against your Railway API — same as local demo.

## One-time Neon schema (if `/health/db` says users table missing)

On your PC (PowerShell), from the repo root, with Neon **direct** URL (no `-pooler`):

```powershell
$env:DATABASE_URL = "<paste Neon URL>"
pnpm db:migrate
```

Then reload `https://<api>/health/db` → expect `{"status":"ok","users":0}`.

- Build fails on pnpm → ensure latest commit with Dockerfile is on `master`
- **CRASHED at start** → open **View logs** ; if migrate fails:
  1. Prefer Neon **direct** URL (host **without** `-pooler`) as `DATABASE_URL`
  2. In Neon **SQL Editor**: `CREATE EXTENSION IF NOT EXISTS vector;`
  3. Settings → Deploy → **clear Custom Start Command** (leave empty; use Dockerfile)
- Migrate fails on `vector` → Neon SQL Editor → `CREATE EXTENSION IF NOT EXISTS vector;`
- `/me` 500 after login → same DB/migrate issue; check Railway logs for Prisma errors
- CORS errors → check `WEB_ORIGIN` matches the exact Vercel URL (https, no trailing slash)
