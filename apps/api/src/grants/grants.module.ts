import { Module } from "@nestjs/common";
import { TenancyModule } from "../tenancy/tenancy.module.js";
import { GrantsController } from "./grants.controller.js";
import { GrantsService } from "./grants.service.js";

@Module({
  imports: [TenancyModule],
  controllers: [GrantsController],
  providers: [GrantsService],
  exports: [GrantsService],
})
export class GrantsModule {}
