# Phase 32 — Validation / checklist PO

**Date :** 2026-07-19  
**Pack :** EC\* Accepted (+ EC6bis · EC8bis · EC10bis)  
**Statut livraison :** **Validée PO (2026-07-19)**  
**Gel :** Phase 33 = **pack décisions dédié** (pas d’auto)

## Amendements confirmés PO

| ID | Règle | Preuve |
|----|-------|--------|
| EC6bis | Export org = métadonnées conversations only | `buildOrgExportPayload` · `conversations_metadata` |
| EC8bis | Audit retention configurable ≥ 365 j | `audit_retention_days` · `clampAuditRetentionDays` |
| EC10bis | Soft-deleted adressée → **410** · sinon **404** | `GoneException` · `RbacService` · `AuthGuard` |

## Checklist EC12 (atteinte)

| # | Critère | Preuve |
|---|---------|--------|
| 1 | Soft delete org + restore grace | `softDeleteOrganization` · `restoreOrganization` |
| 2 | Export user avec messages auteur | `buildUserExportPayload` |
| 3 | Export org sans corps de messages | EC6bis |
| 4 | Anonymize + audit conservé | `anonymizeUser` · `hardPurgeOrganization` garde audit |
| 5 | `audit_events` append-only | insert-only API |
| 6 | Quota EB7bis + `quota.override` event | `QuotasService.putOverrides` |
| 7 | UI `/privacy` | PrivacyAdmin |
| 8 | Metrics | `verse_gdpr_export_total` · `verse_soft_delete_total` · `verse_purge_total` |

## Hors scope (gel)

Phase 33 pentest · Phase 34 Stripe · legal hold · S3 mass purge (N/A si aucun objet).
