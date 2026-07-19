import { Module } from "@nestjs/common";
import { QuotasModule } from "../quotas/quotas.module.js";
import { TenancyModule } from "../tenancy/tenancy.module.js";
import { PackagesController } from "./packages.controller.js";
import { PackagesService } from "./packages.service.js";

@Module({
  imports: [TenancyModule, QuotasModule],
  controllers: [PackagesController],
  providers: [PackagesService],
  exports: [PackagesService],
})
export class PackagesModule {}
