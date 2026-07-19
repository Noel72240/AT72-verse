import { Module } from "@nestjs/common";
import { LlmUsageProjectorService } from "./llm-usage.projector.js";

@Module({
  providers: [LlmUsageProjectorService],
})
export class LlmModule {}
