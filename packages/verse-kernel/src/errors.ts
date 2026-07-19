/**
 * Normalized Kernel errors (Phase 07 Decision I).
 * Public to callers; does not change KernelClient method signatures.
 */
export type KernelErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "BUDGET_EXCEEDED"
  | "UNAVAILABLE"
  | "PROVIDER_ERROR"
  | "RATE_LIMIT"
  | "AUTH"
  | "TIMEOUT"
  | "CONNECTOR_NOT_CONNECTED"
  | "WAITING_APPROVAL"
  | "APPROVAL_ALREADY_CONSUMED"
  | "INTERNAL";

export class KernelError extends Error {
  readonly code: KernelErrorCode;
  readonly retryable: boolean;
  readonly details: Record<string, unknown> | undefined;

  constructor(
    code: KernelErrorCode,
    message: string,
    options?: { retryable?: boolean; details?: Record<string, unknown>; cause?: unknown },
  ) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = "KernelError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.details = options?.details;
  }
}
