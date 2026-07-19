/**
 * Normalize provider SDK failures into KernelError (Phase 13 / AY1).
 * Never forward raw OpenAI messages to Kernel callers.
 */
import { KernelError, type KernelErrorCode } from "@at72-verse/verse-kernel";

function statusOf(err: unknown): number | undefined {
  if (err && typeof err === "object") {
    const o = err as { status?: number; statusCode?: number };
    return o.status ?? o.statusCode;
  }
  return undefined;
}

function codeOf(err: unknown): string | undefined {
  if (err && typeof err === "object" && "code" in err) {
    const c = (err as { code?: unknown }).code;
    return typeof c === "string" ? c : undefined;
  }
  return undefined;
}

export function mapProviderError(err: unknown, provider: string): KernelError {
  if (err instanceof KernelError) {
    return err;
  }

  const status = statusOf(err);
  const code = codeOf(err)?.toLowerCase() ?? "";

  let kernelCode: KernelErrorCode = "PROVIDER_ERROR";
  let message = `LLM provider "${provider}" failed`;
  let retryable = false;

  if (status === 401 || status === 403 || code.includes("auth") || code === "invalid_api_key") {
    kernelCode = "AUTH";
    message = `LLM provider "${provider}" authentication failed`;
  } else if (status === 429 || code.includes("rate")) {
    kernelCode = "RATE_LIMIT";
    message = `LLM provider "${provider}" rate limit exceeded`;
    retryable = true;
  } else if (status === 408 || code.includes("timeout") || code === "etimedout") {
    kernelCode = "TIMEOUT";
    message = `LLM provider "${provider}" timed out`;
    retryable = true;
  } else if (status !== undefined && status >= 500) {
    kernelCode = "PROVIDER_ERROR";
    message = `LLM provider "${provider}" unavailable`;
    retryable = true;
  }

  return new KernelError(kernelCode, message, {
    retryable,
    details: { provider, http_status: status ?? null },
    // cause kept internal — message never includes SDK text
    cause: err,
  });
}
