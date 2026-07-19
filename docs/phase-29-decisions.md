# Phase 29 — Pack de décisions (DZ\*) — Validée PO

**Statut :** **Validée PO (2026-07-19)**  
**Amendements PO confirmés :**  
1. **DZ3bis** — `require_approval: true` **seulement** pour **nouveaux** workspaces ; existants inchangés jusqu’activation explicite  
2. **Reprise idempotente** — un `approval_id` n’est **consommable qu’une fois** (pas de double side-effect : double-clic, retry HTTP, concurrence)  
**Date :** 2026-07-19  
**Prérequis :** Phase **28 validée** (28a `767902c` · 28b `a5e8ad8`) · ADR-013 Accepted  
**Lot :** **HITL** — approbation avant side-effects à risque  
**Implémentation :** **29 validée PO** · **Phase 30 = pack décisions dédié** (pas d’auto)

---

## Objectif

Bloquer `social-publish` **live** (et tools équivalents sous policy) jusqu’à approbation humaine · reject / expire = **aucun** side-effect · dry-run sans HITL.

---

## Décisions Accepted (livraison validée)

| ID | Décision |
|----|----------|
| DZ1 | Périmètre HITL MVP (ApprovalRequest · gate · API/UI · timeout · audit) |
| DZ2-A | HITL seulement si side_effect + `mode:"live"` + `require_approval` |
| DZ3-A | Flag sur **CapabilityGrant** |
| **DZ3bis (amendé)** | **Nouveaux** WS : `require_approval=true` pour `social-publish` · **existants** : restent `false` jusqu’activation owner |
| DZ4-A | Gate **ToolRuntime** (avant OAuth live) |
| DZ5-A | Soft status `waiting_approval` + `approval_id` |
| DZ6-A | API + inbox UI |
| DZ6bis-A | Approvers = workspace **ADMIN** ou **OWNER** |
| DZ7-A | Timeout défaut **24h** |
| DZ8 | Preview redacté · jamais de secrets |
| DZ9-A | Pas de nœud workflow HITL en P29 |
| DZ10–DZ12 | Checklist · tests · gel P30 |
| **Idempotence (amendé)** | Consommation **single-flight** : transition atomique unique vers exécution du side-effect |

### Idempotence — règles

1. `approve` : `pending → approved` **atomique** (une seule victoire).  
2. Exécution live post-approve : claim atomique `approved → executed` (ou équivalent) **avant** tout appel LinkedIn.  
3. Retry / double-clic / concurrence : perdants → no-op ou réponse idempotente · **zéro** second publish.  
4. `reject` / `expire` : terminal · jamais d’exécution.

### Checklist validation PO (atteinte)

- [x] Modèle `ApprovalRequest` + contrats publics  
- [x] Statut `waiting_approval`  
- [x] Gate HITL ToolRuntime  
- [x] Stockage + migration DB  
- [x] API approve / reject  
- [x] Inbox UI + toggle `require_approval`  
- [x] Signatures `Kernel.tools` inchangées  
- [x] Tests (gate · dry-run · claim unique)

---

## Prochaine étape

1. **Commit Phase 29** · stop.  
2. **Pack Phase 30** (observabilité) soumis PO · **aucune implémentation** sans validation.
