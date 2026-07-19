# Phase 31 — Validation / checklist PO

**Date :** 2026-07-19  
**Pack :** EB\* Accepted (+ EB3bis · EB7bis)  
**Statut livraison :** **Validée PO (2026-07-19)**  
**Gel :** Phase 32 = **pack décisions dédié** (pas d’auto)

## Amendements confirmés PO

| ID | Règle | Preuve |
|----|-------|--------|
| EB3bis | Aucun « unlimited » — Enterprise = plafonds numériques élevés | `PLAN_QUOTA_DEFAULTS` · tests `plan-quotas.test.ts` |
| EB7bis | Audit override : actor · previous · new · ts UTC · reason? | `quota_audit_entries` · `updateOrgQuotas` |

## Checklist EB9–EB10 (atteinte)

| # | Critère | Preuve |
|---|---------|--------|
| 1 | Plan org `free`/`pro`/`enterprise` | `organizations.plan_id` |
| 2 | Limites effectives toujours numériques | `resolveOrgQuotaLimits` |
| 3 | Runs / tokens / agents enforce | `assertCanCreateRun` · `assertCanInstallAgent` |
| 4 | 429 `QUOTA_EXCEEDED` + `upgrade_hint` | `QuotasService` |
| 5 | RPM Redis · fail-closed si Redis requis | `rate-limit.redis.ts` · `VERSE_RATE_LIMIT_FAIL_OPEN` |
| 6 | OWNER override + audit | `PUT /organizations/:orgId/quotas` |
| 7 | UI quotas + hint install | `/quotas` · PackagesAdmin |
| 8 | Metrics | `verse_quota_exceeded_total` · `verse_rate_limited_total` |

## Hors scope (gel)

Phase 32 soft-delete / audit RGPD · Phase 33 pentest · Stripe (P34).
