import { Module } from "@nestjs/common";
import { TenancyModule } from "../tenancy/tenancy.module.js";
import { ConnectorsController } from "./connectors.controller.js";
import { ConnectorsService } from "./connectors.service.js";

@Module({
  imports: [TenancyModule],
  controllers: [ConnectorsController],
  providers: [ConnectorsService],
  exports: [ConnectorsService],
})
export class ConnectorsModule {}
