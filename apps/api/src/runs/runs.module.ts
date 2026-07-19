import { Module } from "@nestjs/common";
import { GrantsModule } from "../grants/grants.module.js";
import { PackagesModule } from "../packages/packages.module.js";
import { PersonaModule } from "../persona/persona.module.js";
import { TenancyModule } from "../tenancy/tenancy.module.js";
import { RunsController } from "./runs.controller.js";
import { RunsStreamController } from "./runs-stream.controller.js";
import { RunsProjectorService } from "./runs.projector.js";
import { RunsService } from "./runs.service.js";

@Module({
  imports: [TenancyModule, PersonaModule, GrantsModule, PackagesModule],
  controllers: [RunsController, RunsStreamController],
  providers: [RunsService, RunsProjectorService],
  exports: [RunsService],
})
export class RunsModule {}
