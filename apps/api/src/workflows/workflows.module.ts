import { Module } from "@nestjs/common";
import { PackagesModule } from "../packages/packages.module.js";
import { TenancyModule } from "../tenancy/tenancy.module.js";
import { WorkflowsController } from "./workflows.controller.js";
import { WorkflowsService } from "./workflows.service.js";

@Module({
  imports: [TenancyModule, PackagesModule],
  controllers: [WorkflowsController],
  providers: [WorkflowsService],
  exports: [WorkflowsService],
})
export class WorkflowsModule {}
