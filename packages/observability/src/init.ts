/**
 * Observability bootstrap (Phase 30 / EA9).
 */
import { initTracing, isOtelEnabled } from "./tracing.js";
import { getMetrics } from "./metrics.js";
import { log } from "./logger.js";
import { createKernelInstrumentationSink } from "./kernel-sink.js";
import type { KernelInstrumentationSink } from "@at72-verse/verse-kernel";

export type ObservabilityHandle = {
  enabled: boolean;
  serviceName: string;
  metrics: ReturnType<typeof getMetrics>;
  kernelSink: KernelInstrumentationSink;
};

let handle: ObservabilityHandle | undefined;

export function initObservability(input: { serviceName: string }): ObservabilityHandle {
  initTracing({ serviceName: input.serviceName });
  handle = {
    enabled: isOtelEnabled(),
    serviceName: input.serviceName,
    metrics: getMetrics(),
    kernelSink: createKernelInstrumentationSink(),
  };
  log.info("observability_init", {
    service: input.serviceName,
    status: handle.enabled ? "otel_on" : "otel_off",
  });
  return handle;
}

export function getObservability(): ObservabilityHandle | undefined {
  return handle;
}
