import { Module } from "@nestjs/common";
import { GrantsModule } from "../grants/grants.module.js";
import { PackagesModule } from "../packages/packages.module.js";
import { TenancyModule } from "../tenancy/tenancy.module.js";
import { ApprovalsController } from "./approvals.controller.js";
import { ApprovalsService } from "./approvals.service.js";

@Module({
  imports: [TenancyModule, GrantsModule, PackagesModule],
  controllers: [ApprovalsController],
  providers: [ApprovalsService],
  exports: [ApprovalsService],
})
export class ApprovalsModule {}
