import { Module } from "@nestjs/common";
import { TenancyModule } from "../tenancy/tenancy.module.js";
import { PackagesController } from "./packages.controller.js";
import { PackagesService } from "./packages.service.js";

@Module({
  imports: [TenancyModule],
  controllers: [PackagesController],
  providers: [PackagesService],
  exports: [PackagesService],
})
export class PackagesModule {}
