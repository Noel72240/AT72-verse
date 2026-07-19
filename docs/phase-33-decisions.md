# Phase 33 — Pack de décisions (ED\*) — Validée PO

**Statut :** **Validée PO (2026-07-19)**  
**Amendements PO confirmés :**  
1. **ED5bis** — seuils rate limit auth **configurables** via env · valeurs pack = **défauts** seulement  
2. **ED6bis** — CSP **report-only** · endpoint reporting configurable · désactivable en dev · préparation bascule enforce (phase ultérieure)  
3. **ED8bis** — clôture exige **0 Critical** et **0 High** ouverts · Medium/Low OK seulement avec owner · priorité · phase cible  
**Date :** 2026-07-19  
**Prérequis :** Phase **32 validée** (commit `cad7b3b`)  
**Lot :** **Hardening sécurité & pentest interne**  
**Implémentation :** **33 validée PO** · **Phase 34 = pack décisions dédié** (pas d’auto)  
**Jalon :** **J5 — Platform** clôturable (hardening livré)

---

## Objectif

Threat model · Kernel chokepoint · IDOR · auth rate limit · headers / CSP report-only · backup drill · rapport pentest interne (0 Critical · 0 High).

---

## Décisions Accepted (livraison validée)

| ID | Décision |
|----|----------|
| ED1 | MVP hardening interne · gel P34 |
| ED2 | Threat model STRIDE léger |
| ED3 | Checklist Kernel + tests |
| ED4 | Suite IDOR CI golden paths |
| **ED5 + ED5bis** | Rate limit auth Redis · **seuils via env** (défauts pack) |
| **ED6-A1 + ED6bis** | Headers + CSP **report-only** · report URI configurable · off en dev · enforce plus tard |
| ED7 | Runbook backup/restore + 1 drill |
| **ED8 + ED8bis** | Rapport interne · **0 Critical · 0 High** · M/L documentés |
| ED9 | Secrets hygiene + scan léger |
| ED10 | Checklist livrables |
| ED11 | Gel P34+ |

### Checklist validation PO (atteinte)

- [x] Threat model  
- [x] Revue Kernel  
- [x] Suite IDOR  
- [x] Rate limiting Auth (ED5bis)  
- [x] Security headers  
- [x] CSP Report-Only (ED6bis)  
- [x] Runbook backup/restore + drill  
- [x] Rapport pentest interne (ED8bis)  
- [x] Tests + docs  

---

## Prochaine étape

1. **Commit Phase 33** · stop.  
2. **Pack Phase 34** (Billing Stripe) soumis PO · **aucune implémentation** sans validation.
