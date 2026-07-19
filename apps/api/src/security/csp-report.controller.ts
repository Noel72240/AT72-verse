/**
 * CSP report collector (Phase 33 / ED6bis) — report-only sink.
 * Disabled when VERSE_CSP_REPORT_ENABLED=0.
 */
import { Body, Controller, HttpCode, Post } from "@nestjs/common";

@Controller()
export class CspReportController {
  @Post("csp-report")
  @HttpCode(204)
  report(@Body() _body: unknown) {
    if (process.env.VERSE_CSP_REPORT_ENABLED === "0") {
      return;
    }
    // Intentionally no free-text logging of report body (EA5bis) — count only via metrics later.
    return;
  }
}
