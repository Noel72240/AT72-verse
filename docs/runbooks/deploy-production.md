# Runbook: deploy-production

## Web (SaaS UI)

See **[deploy-vercel.md](./deploy-vercel.md)** — Next.js `@at72-verse/web` on Vercel (monorepo root directory `apps/web`).

## API / runtime (Nest + workers)

Not on Vercel. Target a long-running host (Railway / Fly / Render / Cloud Run / K8s) with:

- Postgres (`DATABASE_URL`)
- Redis (`REDIS_URL`)
- `WEB_ORIGIN` = Vercel URL
- Billing env (`PAYMENT_PROVIDER`, SumUp keys, etc.) when needed

Compose under `infra/docker/` remains **local data plane** only (Postgres/Redis/MinIO).

## Rollback

- Web: Vercel → previous Deployment → Promote
- API: redeploy previous image / release on the PaaS
