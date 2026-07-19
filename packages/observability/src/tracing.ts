/**
 * Lightweight tracing + optional OTLP/HTTP JSON export (Phase 30 / EA2-A).
 * No heavy SDK required when VERSE_OTEL_ENABLED is off.
 */
import { randomUUID } from "node:crypto";
import { sanitizeAttributes } from "./redact.js";
import { log } from "./logger.js";

export type SpanAttributes = Record<string, unknown>;

export type VerseSpan = {
  traceId: string;
  spanId: string;
  name: string;
  startMs: number;
  endMs?: number;
  attributes: Record<string, string | number | boolean>;
  status: "ok" | "error";
  errorCode?: string;
};

type TracerState = {
  enabled: boolean;
  serviceName: string;
  endpoint: string | null;
  spans: VerseSpan[];
};

let state: TracerState = {
  enabled: false,
  serviceName: "at72-verse",
  endpoint: null,
  spans: [],
};

export function isOtelEnabled(): boolean {
  return process.env.VERSE_OTEL_ENABLED === "1" || process.env.VERSE_OTEL_ENABLED === "true";
}

export function initTracing(input: { serviceName: string }): void {
  state = {
    enabled: isOtelEnabled(),
    serviceName: input.serviceName,
    endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.replace(/\/$/, "") || null,
    spans: [],
  };
  if (state.enabled) {
    log.info("otel_enabled", {
      service: state.serviceName,
      endpoint: state.endpoint ?? "none",
    });
  }
}

export function startSpan(
  name: string,
  attrs?: SpanAttributes,
  opts?: { traceId?: string; parentSpanId?: string },
): VerseSpan {
  const span: VerseSpan = {
    traceId: opts?.traceId ?? randomUUID().replace(/-/g, ""),
    spanId: randomUUID().replace(/-/g, "").slice(0, 16),
    name,
    startMs: Date.now(),
    attributes: sanitizeAttributes({
      service: state.serviceName,
      ...(attrs ?? {}),
    }),
    status: "ok",
  };
  if (state.enabled) state.spans.push(span);
  return span;
}

export function endSpan(
  span: VerseSpan,
  outcome?: { error?: boolean; errorCode?: string; attrs?: SpanAttributes },
): void {
  span.endMs = Date.now();
  if (outcome?.error) {
    span.status = "error";
    span.errorCode = outcome.errorCode;
  }
  if (outcome?.attrs) {
    Object.assign(span.attributes, sanitizeAttributes(outcome.attrs));
  }
  if (!state.enabled) return;
  void flushSpan(span).catch((err) => {
    log.warn("otel_export_failed", {
      code: err instanceof Error ? err.name : "error",
    });
  });
}

async function flushSpan(span: VerseSpan): Promise<void> {
  if (!state.endpoint) {
    // Collector optional — keep in-memory for /debug; still log correlation ids.
    log.debug("span", {
      family: "otel",
      method: span.name,
      trace_id: span.traceId,
      span_id: span.spanId,
      duration_ms: (span.endMs ?? Date.now()) - span.startMs,
      status: span.status,
      ...(span.errorCode ? { error_code: span.errorCode } : {}),
      ...span.attributes,
    });
    return;
  }
  const durationNano = BigInt(((span.endMs ?? Date.now()) - span.startMs) * 1_000_000);
  const startNano = BigInt(span.startMs) * 1_000_000n;
  const attributes = Object.entries(span.attributes).map(([key, value]) => {
    if (typeof value === "number") {
      return { key, value: { doubleValue: value } };
    }
    if (typeof value === "boolean") {
      return { key, value: { boolValue: value } };
    }
    return { key, value: { stringValue: String(value) } };
  });
  const body = {
    resourceSpans: [
      {
        resource: {
          attributes: [
            { key: "service.name", value: { stringValue: state.serviceName } },
          ],
        },
        scopeSpans: [
          {
            scope: { name: "at72-verse" },
            spans: [
              {
                traceId: span.traceId,
                spanId: span.spanId,
                name: span.name,
                kind: 1,
                startTimeUnixNano: startNano.toString(),
                endTimeUnixNano: (startNano + durationNano).toString(),
                attributes,
                status: {
                  code: span.status === "error" ? 2 : 1,
                  message: span.errorCode ?? "",
                },
              },
            ],
          },
        ],
      },
    ],
  };
  const url = state.endpoint.includes("/v1/traces")
    ? state.endpoint
    : `${state.endpoint}/v1/traces`;
  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Test helper — recent in-memory spans when OTel on. */
export function getBufferedSpans(): readonly VerseSpan[] {
  return state.spans;
}

export function resetTracingForTests(): void {
  state = {
    enabled: false,
    serviceName: "test",
    endpoint: null,
    spans: [],
  };
}
