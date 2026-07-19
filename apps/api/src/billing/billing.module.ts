import { Module } from "@nestjs/common";
import { TenancyModule } from "../tenancy/tenancy.module.js";
import { BillingController } from "./billing.controller.js";
import { BillingService, PAYMENT_PROVIDER, createPaymentProvider } from "./billing.service.js";
import { PaymentWebhookController } from "./payment-webhook.controller.js";

@Module({
  imports: [TenancyModule],
  controllers: [BillingController, PaymentWebhookController],
  providers: [
    BillingService,
    {
      provide: PAYMENT_PROVIDER,
      useFactory: createPaymentProvider,
    },
  ],
  exports: [BillingService],
})
export class BillingModule {}
