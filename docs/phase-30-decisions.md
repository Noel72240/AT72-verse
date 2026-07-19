# Phase 30 — Pack de décisions (EA\*) — Validée PO

**Statut :** **Validée PO (2026-07-19)**  
**Amendements PO confirmés :**  
1. **EA5bis** — jamais de texte libre utilisateur dans attributs OTel / logs ; métadonnées techniques only ; aperçus contenu = allowlist explicite + tronqué/redacté  
2. **EA10bis** — cible perf : surcharge **&lt; 5 %** sur golden paths mesurés quand l’observabilité est activée · documentée dans les résultats de validation  
**Date :** 2026-07-19  
**Prérequis :** Phase **29 validée** (commit `928ae6f`)  
**Lot :** **Observabilité production-ready**  
**Implémentation :** **30 validée PO** · **Phase 31 = pack décisions dédié** (pas d’auto)

---

## Objectif

Incident plateforme diagnostiquable **&lt; 15 min** via `run_id` / `trace_id`, redaction PII renforcée, surcharge observabilité **&lt; 5 %** sur golden paths — sans changer les signatures Kernel.

---

## Décisions Accepted (livraison validée)

| ID | Décision |
|----|----------|
| EA1 | Périmètre MVP (OTel · metrics · logs · Grafana · debugger · PII · gel P31) |
| EA2-A | OTel → OTLP → collector → Tempo/Prometheus/Grafana (compose profile) |
| EA3-A | Instrumentation hosts + Core only (pas Agents/Skills) |
| EA4 | Corrélation `trace_id` + attributs techniques obligatoires |
| **EA5-A + EA5bis** | Deny-by-default · **aucun texte libre user** dans OTel/logs · allowlist métadonnées · aperçus seulement si allowlist + truncate/redact |
| EA6 | Metrics MVP (http · run · tool · dlq · kernel reject) |
| EA7-A | Alertes Grafana minimales |
| EA8-A | Enrichir run debugger existant (HITL · `trace_id`) |
| EA9 | `VERSE_OTEL_ENABLED` · `OTEL_EXPORTER_OTLP_ENDPOINT` · défaut off local |
| **EA10 + EA10bis** | Tests + critère perf **&lt; 5 %** overhead documenté |
| EA11 | Checklist PO |
| EA12 | Gel P31+ |

### Checklist validation PO (atteinte)

- [x] `@at72-verse/observability`  
- [x] OpenTelemetry optionnel  
- [x] Metrics Prometheus  
- [x] Kernel instrumentation sink  
- [x] Corrélation `trace_id` / `run_id`  
- [x] Metrics Runtime + DLQ  
- [x] Compose observability  
- [x] Run debugger enrichi  
- [x] Runbook + validation docs  
- [x] Tests redaction + overhead &lt; 5 %

---

## Prochaine étape

1. **Commit Phase 30** · stop.  
2. **Pack Phase 31** (quotas / plans / rate limits) soumis PO · **aucune implémentation** sans validation.
