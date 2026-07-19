/**
 * Client IP helper for auth rate limiting (Phase 33 / ED5).
 */
import type { RequestWithAuth } from "../auth/auth.tokens.js";

export function clientIp(req: RequestWithAuth & { ip?: string; headers: Record<string, unknown> }): string {
  const xf = req.headers["x-forwarded-for"];
  if (typeof xf === "string" && xf.trim()) {
    return xf.split(",")[0]!.trim();
  }
  if (Array.isArray(xf) && xf[0]) {
    return String(xf[0]).split(",")[0]!.trim();
  }
  return req.ip?.trim() || "unknown";
}
