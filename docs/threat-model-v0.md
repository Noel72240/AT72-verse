# Threat model v0 — AT72 Verse (Phase 33 / ED2)

**Date :** 2026-07-19  
**Méthode :** STRIDE léger par surface  
**Statut :** livrable P33

## Acteurs

| Acteur | Confiance |
|--------|-----------|
| Utilisateur authentifié (Clerk / Dev) | Semi-trusted |
| Owner / Admin org | Trusted dans son tenant |
| Agent Runtime | Untrusted — doit passer Kernel |
| Attaquant anonyme (Internet) | Untrusted |
| Opérateur plateforme | Trusted (ops) |

## Trust boundaries

1. **Browser ↔ API** — Bearer token · CORS · headers  
2. **API ↔ Postgres / Redis** — réseau privé local/prod  
3. **API / Core ↔ Kernel.tools** — chokepoint obligatoire  
4. **Core ↔ Vault / OAuth providers** — secrets ciphertext · plaintext éphémère  
5. **Bus (Redis Streams)** — messages techniques, pas de secrets  

## Surfaces & risques (STRIDE résumé)

### Auth / session

| Menace | Risque | Mitigation |
|--------|--------|------------|
| Spoofing login | Moyen | IdP · AuthGuard · rate limit auth (ED5) |
| Brute force | Moyen | `AUTH_RATE_LIMITED` · env thresholds |
| Elevation | Faible | RBAC org/workspace |

### API tenancy / IDOR

| Menace | Risque | Mitigation |
|--------|--------|------------|
| IDOR cross-tenant | Élevé | RBAC + tests IDOR (ED4) · soft-delete 410 |
| Info disclosure soft-delete | Moyen | 410 vs 404 (EC10bis) |

### Kernel tools / side-effects

| Menace | Risque | Mitigation |
|--------|--------|------------|
| Bypass tool gate | Critique | Kernel chokepoint only · checklist ED3 |
| Secret leak to agent | Critique | Vault resolve Core only · HITL live |

### Vault / OAuth

| Menace | Risque | Mitigation |
|--------|--------|------------|
| Token theft at rest | Élevé | Ciphertext vault · ADR-013 |
| SSRF via connector | Moyen | Allowlist providers |

### Bus / observability

| Menace | Risque | Mitigation |
|--------|--------|------------|
| PII in logs/traces | Moyen | EA5bis redaction |
| DLQ poison | Faible | Metrics + runbook |

### GDPR exports

| Menace | Risque | Mitigation |
|--------|--------|------------|
| Export job IDOR | Élevé | Ownership check job.userId |
| Org export over-share | Moyen | EC6bis metadata only |

## Gaps traités en P33

- Rate limit auth configurable  
- Security headers + CSP report-only  
- Suite IDOR enrichie  
- Backup/restore documenté  
- Rapport pentest interne  

## Hors scope (phases ultérieures)

- Pentest externe · bug bounty · CSP enforce · WAF · Stripe (P34)
