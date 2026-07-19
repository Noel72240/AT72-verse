import { Module } from "@nestjs/common";
import { BillingModule } from "../billing/billing.module.js";
import { TenancyModule } from "../tenancy/tenancy.module.js";
import { QuotasController } from "./quotas.controller.js";
import { QuotasService } from "./quotas.service.js";

@Module({
  imports: [TenancyModule, BillingModule],
  controllers: [QuotasController],
  providers: [QuotasService],
  exports: [QuotasService],
})
export class QuotasModule {}
