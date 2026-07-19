import {
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  type RawBodyRequest,
} from "@nestjs/common";
import type { Request } from "express";
import { BillingService } from "./billing.service.js";

/**
 * Provider webhooks — signature verified inside PaymentProvider (no user AuthGuard).
 */
@Controller("webhooks")
export class PaymentWebhookController {
  constructor(private readonly billing: BillingService) {}

  @Post("payments")
  @HttpCode(200)
  async payments(
    @Req() req: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    const raw =
      typeof req.rawBody === "string"
        ? req.rawBody
        : Buffer.isBuffer(req.rawBody)
          ? req.rawBody.toString("utf8")
          : JSON.stringify(req.body ?? {});
    return this.billing.handleRawWebhook(headers, raw);
  }
}
