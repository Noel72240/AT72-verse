import { Body, Controller, Headers, HttpException, HttpStatus, Post, Req } from "@nestjs/common";
import type { RequestWithAuth } from "../auth/auth.tokens.js";
import { checkAuthRateLimit } from "../quotas/rate-limit.redis.js";
import { clientIp } from "../security/client-ip.js";

/**
 * Clerk webhook stub (Phase 05 Decision B).
 * Signature verification + lifecycle sync arrive in a later phase.
 * Phase 33: auth rate limited (ED5).
 */
@Controller("webhooks")
export class ClerkWebhookController {
  @Post("clerk")
  async handleClerk(
    @Req() req: RequestWithAuth & { ip?: string },
    @Headers("svix-id") _svixId: string | undefined,
    @Headers("svix-timestamp") _svixTimestamp: string | undefined,
    @Headers("svix-signature") _svixSignature: string | undefined,
    @Body() body: unknown,
  ) {
    try {
      const rl = await checkAuthRateLimit("webhook", clientIp(req));
      if (!rl.allowed) {
        throw new HttpException(
          {
            code: "AUTH_RATE_LIMITED",
            message: "Webhook rate limit exceeded",
            limit: rl.limit,
            reset_at: rl.reset_at,
            retry_after: rl.retry_after_sec,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (err) {
      if (err instanceof HttpException) throw err;
      throw new HttpException(
        { code: "unavailable", message: "Rate limiter unavailable" },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return {
      received: true,
      status: "stub",
      phase: 5,
      note: "Clerk webhook accepted but not processed yet",
      payloadType: body === null || body === undefined ? "empty" : typeof body,
    };
  }
}
