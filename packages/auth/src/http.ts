import type { IncomingAuthRequest } from "./types.js";

export function headerValue(
  headers: IncomingAuthRequest["headers"],
  name: string,
): string | undefined {
  const target = name.toLowerCase();
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    return headers.get(name) ?? headers.get(target) ?? undefined;
  }
  const record = headers as Record<string, string | string[] | undefined>;
  for (const [key, value] of Object.entries(record)) {
    if (key.toLowerCase() === target) {
      if (Array.isArray(value)) return value[0];
      return value;
    }
  }
  return undefined;
}

export function extractBearerToken(request: IncomingAuthRequest): string | undefined {
  const authorization = headerValue(request.headers, "authorization");
  if (!authorization) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(authorization.trim());
  return match?.[1]?.trim() || undefined;
}
