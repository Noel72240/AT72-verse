import { Body, Controller, Headers, Post } from "@nestjs/common";

/**
 * Clerk webhook stub (Phase 05 Decision B).
 * Signature verification + lifecycle sync arrive in a later phase.
 */
@Controller("webhooks")
export class ClerkWebhookController {
  @Post("clerk")
  handleClerk(
    @Headers("svix-id") _svixId: string | undefined,
    @Headers("svix-timestamp") _svixTimestamp: string | undefined,
    @Headers("svix-signature") _svixSignature: string | undefined,
    @Body() body: unknown,
  ) {
    return {
      received: true,
      status: "stub",
      phase: 5,
      note: "Clerk webhook accepted but not processed yet",
      payloadType: body === null || body === undefined ? "empty" : typeof body,
    };
  }
}
