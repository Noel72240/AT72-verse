/**
 * Structured JSON logger with redaction (Phase 30 / EA5bis).
 */
import { sanitizeAttributes } from "./redact.js";

export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogFields = Record<string, unknown>;

function emit(level: LogLevel, message: string, fields?: LogFields): void {
  const safe = sanitizeAttributes(fields ?? {});
  // `msg` is short operational text from hosts — never pass user goal/content here.
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg: message.slice(0, 200),
    ...safe,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const log = {
  debug: (message: string, fields?: LogFields) => emit("debug", message, fields),
  info: (message: string, fields?: LogFields) => emit("info", message, fields),
  warn: (message: string, fields?: LogFields) => emit("warn", message, fields),
  error: (message: string, fields?: LogFields) => emit("error", message, fields),
};
