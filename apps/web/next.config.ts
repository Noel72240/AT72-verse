import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * CSP Report-Only (Phase 33 / ED6-A1 + ED6bis).
 * Enforce reserved for a later phase via VERSE_CSP_ENFORCE (not used here).
 */
function buildCspReportOnly(): string | null {
  if (process.env.VERSE_CSP_REPORT_ENABLED === "0") {
    return null;
  }
  const reportUri =
    process.env.VERSE_CSP_REPORT_URI ??
    process.env.NEXT_PUBLIC_CSP_REPORT_URI ??
    "http://localhost:3001/csp-report";
  // Minimal policy for report-only observation — does not block (Report-Only header).
  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self' http://localhost:3001 https:",
    "font-src 'self' data:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    `report-uri ${reportUri}`,
  ].join("; ");
}

const cspReportOnly = buildCspReportOnly();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, "../.."),
  async headers() {
    const security = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Frame-Options", value: "DENY" },
    ];
    if (cspReportOnly) {
      security.push({
        key: "Content-Security-Policy-Report-Only",
        value: cspReportOnly,
      });
    }
    return [
      {
        source: "/:path*",
        headers: security,
      },
    ];
  },
};

export default nextConfig;
