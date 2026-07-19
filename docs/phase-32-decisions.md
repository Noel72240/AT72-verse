# Phase 32 — Pack de décisions (EC\*) — Validée PO

**Statut :** **Validée PO (2026-07-19)**  
**Amendements PO confirmés :**  
1. **EC6bis** — export **org** : config · membres · workspaces · packages · quotas · audit · **métadonnées** conversations uniquement (pas le contenu des messages) ; contenu complet = export user individuel  
2. **EC8bis** — rétention `audit_events` **configurable** · minimum **365 jours** · org peut conserver plus longtemps  
3. **EC10bis** — ressource soft-deleted adressée explicitement → HTTP **410 Gone** ; **404** si inexistante / non visible  
**Date :** 2026-07-19  
**Prérequis :** Phase **31 validée** (commit `f7b76d1`)  
**Lot :** **Soft delete · audit trail · export / delete RGPD basique**  
**Implémentation :** **32 validée PO** · **Phase 33 = pack décisions dédié** (pas d’auto)

---

## Objectif

Conformité minimale pour exploitations EU : soft delete, audit append-only, export / erase — sans certification légale complète.

---

## Décisions Accepted (livraison validée)

| ID | Décision |
|----|----------|
| EC1 | MVP soft delete · audit · export · erase · rétention · gel P33 |
| EC2-A | Tombstone + grace **30 j** (défaut) · restore pendant grace · purge hard après |
| EC3-A | Soft delete **Organization** + **User** |
| EC4-A | Table `audit_events` append-only distincte |
| EC4bis-A | Garder `quota_audit_entries` + `AuditEvent` résumé `quota.override` |
| EC5-A | Matrice rôles (ADMIN audit · OWNER export/delete org · self user) |
| **EC6-A + EC6bis** | Export JSON async · org **sans** contenu messages · user avec contenu auteur |
| EC7-A | Anonymize + purge différée · conserver audit_events |
| **EC8-A + EC8bis** | Grace 7–90 j · audit retention **configurable ≥ 365 j** |
| EC9-A | API + UI Privacy |
| **EC10-A + EC10bis** | Filtres deleted · adressage explicite → **410** · sinon **404** |
| EC11-A | Metrics · pas de free-text (EA5bis) |
| EC12-A | Tests / checklist |
| EC13-A | Gel P33+ |

### Checklist validation PO (atteinte)

- [x] Contracts `0.1.24`  
- [x] Modèle `AuditEvent` / `audit_events`  
- [x] Soft delete Organization / User  
- [x] Exports RGPD + jobs  
- [x] Rétention configurable (EC8bis)  
- [x] Endpoints API + 410 (EC10bis)  
- [x] Page `/privacy`  
- [x] Migrations Prisma  
- [x] Docs + tests  

---

## Prochaine étape

1. **Commit Phase 32** · stop.  
2. **Pack Phase 33** (hardening / pentest) soumis PO · **aucune implémentation** sans validation.
