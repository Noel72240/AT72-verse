/**
 * @at72-verse/observability — Phase 30
 * Tracing, metrics, structured logging with strict free-text redaction (EA5bis).
 */
export const packageName = "@at72-verse/observability" as const;

export {
  sanitizeAttributes,
  assertNoFreeTextLeak,
  TECH_ATTRIBUTE_ALLOWLIST,
  CONTENT_PREVIEW_ALLOWLIST,
  isObservabilityContentPreviewEnabled,
  sha256Hex,
  byteLengthOf,
} from "./redact.js";
export { getMetrics, resetMetricsForTests, MetricsRegistry } from "./metrics.js";
export { log } from "./logger.js";
export {
  initTracing,
  isOtelEnabled,
  startSpan,
  endSpan,
  getBufferedSpans,
  resetTracingForTests,
} from "./tracing.js";
export { createKernelInstrumentationSink } from "./kernel-sink.js";
export { initObservability, getObservability, type ObservabilityHandle } from "./init.js";

/** Documented performance target (EA10bis). */
export const OBSERVABILITY_OVERHEAD_TARGET_PCT = 5 as const;
