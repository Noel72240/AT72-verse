import { Module } from "@nestjs/common";
import { TenancyModule } from "../tenancy/tenancy.module.js";
import { PersonaController } from "./persona.controller.js";
import { PersonaService } from "./persona.service.js";

@Module({
  imports: [TenancyModule],
  controllers: [PersonaController],
  providers: [PersonaService],
  exports: [PersonaService],
})
export class PersonaModule {}
