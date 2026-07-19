/**
 * Bus errors (Phase 10). Explicit codes — never silent stubs.
 */
export type BusErrorCode = "UNAVAILABLE" | "INVALID_MESSAGE" | "INVALID_TOPIC" | "INTERNAL";

export class BusError extends Error {
  readonly code: BusErrorCode;
  readonly retryable: boolean;
  readonly details: Record<string, unknown> | undefined;

  constructor(
    code: BusErrorCode,
    message: string,
    options?: { retryable?: boolean; details?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "BusError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.details = options?.details;
  }
}
