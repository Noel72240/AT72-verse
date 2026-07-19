/**
 * KernelInstrumentationSink → metrics + redacted spans (Phase 30 / EA3-A).
 */
import type { KernelCallRecord, KernelInstrumentationSink } from "@at72-verse/verse-kernel";
import { getMetrics } from "./metrics.js";
import { endSpan, startSpan } from "./tracing.js";
import { byteLengthOf, sanitizeAttributes } from "./redact.js";

export function createKernelInstrumentationSink(): KernelInstrumentationSink {
  return {
    onCall(record: KernelCallRecord): void {
      const metrics = getMetrics();
      const attrs = sanitizeAttributes({
        family: record.family,
        method: record.method,
        run_id: record.context.run_id,
        trace_id: record.context.trace_id,
        span_id: record.context.span_id,
        agent_id: record.context.agent_id,
        organization_id: record.context.organization_id,
        workspace_id: record.context.workspace_id,
        duration_ms: record.duration_ms,
        success: record.success,
        ...(record.error ? { error_code: record.error.code } : {}),
        input_bytes: byteLengthOf(record.input),
        output_bytes: byteLengthOf(record.output),
      });

      if (record.family === "tools" && record.method === "execute") {
        const toolId =
          typeof (record.input as { tool_id?: string } | undefined)?.tool_id === "string"
            ? (record.input as { tool_id: string }).tool_id
            : "unknown";
        const result = record.success
          ? "completed"
          : record.error?.code === "WAITING_APPROVAL"
            ? "WAITING_APPROVAL"
            : record.error?.code === "CONNECTOR_NOT_CONNECTED"
              ? "CONNECTOR_NOT_CONNECTED"
              : "failed";
        metrics.toolExecuteDuration.observe({ tool_id: toolId, result }, record.duration_ms);
        metrics.toolExecute.inc({ tool_id: toolId, result });
      }

      if (!record.success && record.error?.code === "FORBIDDEN") {
        metrics.kernelReject.inc({
          code: record.error.code,
          family: record.family,
        });
      }

      const span = startSpan(`kernel.${record.family}.${record.method}`, attrs, {
        traceId: record.context.trace_id.replace(/-/g, ""),
      });
      endSpan(span, {
        error: !record.success,
        errorCode: record.error?.code,
      });
    },
  };
}
