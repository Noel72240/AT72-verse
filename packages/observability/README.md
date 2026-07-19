# packages/observability

Tracing, metrics, and structured logging for AT72 Verse (**Phase 30**).

## Env

| Variable | Default | Role |
|----------|---------|------|
| `VERSE_OTEL_ENABLED` | off | Enable span export / buffered traces |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | — | OTLP HTTP base (e.g. `http://localhost:4318`) |
| `VERSE_OTEL_ALLOW_CONTENT_PREVIEW` | off | Allow truncated content previews (EA5bis) |

## Redaction (EA5bis)

Attributes and logs never include free-form user text. Only technical metadata (ids, status, durations, error codes, sizes). Content previews require explicit allowlist + env flag.

## Perf target (EA10bis)

When observability is enabled, overhead on measured golden paths must stay **&lt; 5 %** — see `docs/phase-30-validation.md`.
