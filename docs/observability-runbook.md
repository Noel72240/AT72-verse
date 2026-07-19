# Observability runbook (Phase 30)

## Diagnose a failed run in &lt; 15 minutes

1. Open chat timeline or `GET /runs/:runId` — note `status`, `metadata.trace_id`, step `output.approval_id` if HITL.
2. Search logs (JSON) for `run_id` / `trace_id` (never expect raw goal/content — EA5bis).
3. Open Grafana (`http://localhost:3002`) → dashboard **AT72 Verse — Platform MVP**.
4. Optional: Tempo explore with `trace_id` (set `NEXT_PUBLIC_GRAFANA_TRACE_URL` for deep-link).
5. Check `GET /metrics` on API for `verse_tool_execute_total`, `verse_bus_dlq_enqueue_total`, `verse_run_status_total`.
6. If DLQ increased: inspect Redis/bus DLQ topic `verse.dlq`.

## Enable locally

```bash
# Stack
pnpm docker:up
pnpm docker:up:observability

# Apps
VERSE_OTEL_ENABLED=1 OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 pnpm api:dev
VERSE_OTEL_ENABLED=1 OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 pnpm runtime:dev
```

## Alerts (EA7-A)

Configure in Grafana against Prometheus:

- API 5xx rate &gt; 5% over 5m → `sum(rate(verse_http_requests_total{status=~"5.."}[5m])) / sum(rate(verse_http_requests_total[5m]))`
- DLQ enqueue &gt; 0 sustained 5m → `sum(increase(verse_bus_dlq_enqueue_total[5m]))`
