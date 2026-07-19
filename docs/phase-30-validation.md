# Phase 30 — Validation results

**Date :** 2026-07-19  
**Commit target :** Phase 30 livrable  
**Amendements :** EA5bis (no free-text) · EA10bis (overhead &lt; 5 %)  
**Statut livraison :** **Validée PO (2026-07-19)**

## Checklist EA11

| # | Critère | Preuve |
|---|---------|--------|
| 1 | Run échec corrélé via `run_id` / `trace_id` | `metadata.trace_id` persisté au dispatch · timeline UI · logs JSON sanitizés |
| 2 | `waiting_approval` visible | metric `verse_run_status_total{status="waiting_approval"}` · step output `approval_id` |
| 3 | Email dans goal absent OTel/logs | tests `packages/observability/src/redact.test.ts` · `assertNoFreeTextLeak` |
| 4 | DLQ compté | `setDlqEnqueueHook` → `verse_bus_dlq_enqueue_total` |
| 5 | OTel désactivable | défaut off · `VERSE_OTEL_ENABLED` gate |

## Perf — EA10bis

**Target :** observabilité activée ⇒ surcharge **&lt; 5 %** sur golden paths mesurés.

### Méthode

1. Baseline : `VERSE_OTEL_ENABLED` unset — exécuter un golden path déterministe (ToolRuntime dry-run social-publish × N).  
2. Traitement : `VERSE_OTEL_ENABLED=1` sans endpoint (buffer/log only) — même charge.  
3. Overhead = `(t_on - t_off) / t_off * 100`.

### Résultat (mesure unitaire locale)

Script : `packages/observability/src/overhead.bench.test.ts`

| Mode | médiane ms (N=50 tool dry-run) | Overhead |
|------|-------------------------------|----------|
| otel off | mesuré au test | — |
| otel on (no OTLP) | mesuré au test | **&lt; 5 %** (assert CI) |

Le test CI **échoue** si overhead ≥ 5 % (EA10bis).

## Hors scope (gel)

Phase 31 quotas · Phase 32 RGPD · Phase 33 pentest · vendors APM obligatoires.
