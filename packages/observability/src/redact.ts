/**
 * Phase 30 — PII / free-text redaction (EA5bis).
 * Deny-by-default: never export free-form user text unless explicitly allowlisted.
 */
import { createHash } from "node:crypto";

/** Technical metadata keys safe to export as-is. */
export const TECH_ATTRIBUTE_ALLOWLIST = new Set([
  "run_id",
  "trace_id",
  "span_id",
  "organization_id",
  "workspace_id",
  "agent_id",
  "user_id",
  "step_id",
  "tool_id",
  "skill_id",
  "approval_id",
  "status",
  "code",
  "error_code",
  "family",
  "method",
  "duration_ms",
  "http_status",
  "http_method",
  "http_route",
  "success",
  "result",
  "provider",
  "model",
  "topic",
  "event_type",
  "service",
  "phase",
  "input_bytes",
  "output_bytes",
  "content_bytes",
  "content_sha256",
  "content_preview_len",
  "retryable",
  "delegation_depth",
  "side_effect",
  "mode",
  "platform",
  "published",
  "would_publish",
]);

/**
 * Content-ish keys that may be exported ONLY as truncated/redacted previews
 * when `VERSE_OTEL_ALLOW_CONTENT_PREVIEW=1`. Default: omitted entirely.
 */
export const CONTENT_PREVIEW_ALLOWLIST = new Set([
  "content_preview",
  "goal_preview",
  "input_preview",
]);

const FREE_TEXT_DENY = new Set([
  "content",
  "goal",
  "message",
  "messages",
  "prompt",
  "body",
  "input",
  "output",
  "text",
  "payload",
  "access_token",
  "refresh_token",
  "authorization",
  "password",
  "secret",
  "token",
  "vault_ref",
  "oauth",
]);

const MAX_PREVIEW = 64;

export function isObservabilityContentPreviewEnabled(): boolean {
  return process.env.VERSE_OTEL_ALLOW_CONTENT_PREVIEW === "1";
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function byteLengthOf(value: unknown): number {
  try {
    return Buffer.byteLength(typeof value === "string" ? value : JSON.stringify(value), "utf8");
  } catch {
    return 0;
  }
}

function truncatePreview(value: string): string {
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length <= MAX_PREVIEW) return cleaned;
  return `${cleaned.slice(0, MAX_PREVIEW)}…`;
}

/**
 * Sanitize a flat attribute bag for OTel / structured logs (EA5bis).
 * Drops free-text; keeps technical allowlist; optional truncated previews.
 */
export function sanitizeAttributes(
  input: Record<string, unknown> | null | undefined,
): Record<string, string | number | boolean> {
  if (!input) return {};
  const out: Record<string, string | number | boolean> = {};
  const allowPreview = isObservabilityContentPreviewEnabled();

  for (const [rawKey, value] of Object.entries(input)) {
    const key = rawKey.toLowerCase();
    if (value === undefined || value === null) continue;

    if (FREE_TEXT_DENY.has(key) || key.includes("token") || key.includes("secret")) {
      if (typeof value === "string" || typeof value === "object") {
        out[`${key}_bytes`] = byteLengthOf(value);
        if (typeof value === "string") {
          out[`${key}_sha256`] = sha256Hex(value);
        }
      }
      continue;
    }

    if (CONTENT_PREVIEW_ALLOWLIST.has(key)) {
      if (!allowPreview) continue;
      if (typeof value === "string") {
        out[key] = truncatePreview(value);
        out[`${key}_len`] = value.length;
      }
      continue;
    }

    if (!TECH_ATTRIBUTE_ALLOWLIST.has(key) && !TECH_ATTRIBUTE_ALLOWLIST.has(rawKey)) {
      // Unknown keys: only export scalars that look technical (numbers/bools/short ids).
      if (typeof value === "number" || typeof value === "boolean") {
        out[rawKey] = value;
      } else if (typeof value === "string" && value.length <= 64 && !/\s/.test(value)) {
        out[rawKey] = value;
      }
      continue;
    }

    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[rawKey] = value;
    }
  }

  return out;
}

/** Assert helper for tests — fails if free-text patterns leak. */
export function assertNoFreeTextLeak(serialized: string): void {
  const lower = serialized.toLowerCase();
  // Common PII / free-text markers that must not appear as raw attribute values.
  const banned = [
    "user@example.com",
    "+33612345678",
    "write a linkedin post about",
    "ignore previous instructions",
  ];
  for (const b of banned) {
    if (lower.includes(b.toLowerCase())) {
      throw new Error(`Free-text leak detected in observability export: ${b}`);
    }
  }
}
