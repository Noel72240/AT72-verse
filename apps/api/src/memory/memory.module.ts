import { Module } from "@nestjs/common";
import { TenancyModule } from "../tenancy/tenancy.module.js";
import { MemoryController } from "./memory.controller.js";
import { MemoryService } from "./memory.service.js";

@Module({
  imports: [TenancyModule],
  controllers: [MemoryController],
  providers: [MemoryService],
  exports: [MemoryService],
})
export class MemoryModule {}
