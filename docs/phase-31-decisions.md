# Phase 31 — Pack de décisions (EB\*) — Validée PO

**Statut :** **Validée PO (2026-07-19)**  
**Amendements PO confirmés :**  
1. **EB3bis** — **aucun** « illimité » : tous les plans ont des limites numériques ; Enterprise = plafonds techniques très élevés  
2. **EB7bis** — audit léger quota : `actor` · `previous_value` · `new_value` · `timestamp` UTC · `reason` optionnelle  
**Date :** 2026-07-19  
**Prérequis :** Phase **30 validée** (commit `5173d1a`)  
**Lot :** **Quotas, plans techniques & rate limits**  
**Implémentation :** **31 validée PO** · **Phase 32 = pack décisions dédié** (pas d’auto)

---

## Objectif

Empêcher l’abus et borner le coût plateforme via plans techniques, quotas org, rate limits API — sans Stripe (P34).

---

## Décisions Accepted (livraison validée)

| ID | Décision |
|----|----------|
| EB1 | Périmètre MVP (plans · quotas · rate limit · erreurs · admin · gel P32) |
| EB2-A | Plan au niveau **Organization** (`free`/`pro`/`enterprise`) |
| **EB3-A + EB3bis** | Quotas mensuels UTC · **toutes limites numériques** (Enterprise = plafonds très élevés, pas d’unlimited) |
| EB4-A | Enforcement API + complément Cost Engine (pas Agents) |
| EB5-A | `QUOTA_EXCEEDED` / `RATE_LIMITED` · HTTP **429** pour quota |
| EB6-A | Rate limit Redis **fixed-window RPM** · fail-closed si Redis requis · soft-allow sans `REDIS_URL` (local) |
| **EB7-A + EB7bis** | Admin override + **audit léger** (actor, previous, new, ts UTC, reason?) |
| EB8-A | Metrics quota / rate limit |
| EB9–EB10 | Tests · checklist PO |
| EB11 | Gel P32+ |

### Checklist validation PO (atteinte)

- [x] Contracts `0.1.23`  
- [x] Plans techniques numériques (EB3bis)  
- [x] Quotas organisation + migration Prisma  
- [x] Gates `createRun` / install agent  
- [x] Rate limiting Redis  
- [x] Endpoints quotas + audit overrides (EB7bis)  
- [x] UI `/quotas`  
- [x] Docs + tests  

---

## Prochaine étape

1. **Commit Phase 31** · stop.  
2. **Pack Phase 32** (soft delete · audit · export RGPD) soumis PO · **aucune implémentation** sans validation.
