import { Module } from "@nestjs/common";
import { TenancyModule } from "../tenancy/tenancy.module.js";
import { ToolsController } from "./tools.controller.js";
import { ToolsService } from "./tools.service.js";

@Module({
  imports: [TenancyModule],
  controllers: [ToolsController],
  providers: [ToolsService],
  exports: [ToolsService],
})
export class ToolsModule {}
