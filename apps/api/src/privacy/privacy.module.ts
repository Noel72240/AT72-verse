import { Module } from "@nestjs/common";
import { TenancyModule } from "../tenancy/tenancy.module.js";
import { PrivacyController } from "./privacy.controller.js";
import { PrivacyService } from "./privacy.service.js";

@Module({
  imports: [TenancyModule],
  controllers: [PrivacyController],
  providers: [PrivacyService],
  exports: [PrivacyService],
})
export class PrivacyModule {}
