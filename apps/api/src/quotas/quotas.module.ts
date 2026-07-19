import { Module } from "@nestjs/common";
import { TenancyModule } from "../tenancy/tenancy.module.js";
import { QuotasController } from "./quotas.controller.js";
import { QuotasService } from "./quotas.service.js";

@Module({
  imports: [TenancyModule],
  controllers: [QuotasController],
  providers: [QuotasService],
  exports: [QuotasService],
})
export class QuotasModule {}
