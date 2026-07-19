import { Global, Module } from "@nestjs/common";
import { createAuthProvider, DevAuthAdapter, type AuthProvider } from "@at72-verse/auth";
import type { Bus } from "@at72-verse/bus";
import { createPrismaClient, type PrismaClient } from "@at72-verse/db";
import type { VerseCore } from "@at72-verse/verse-core";
import { AuthController } from "./auth/auth.controller.js";
import { AuthGuard } from "./auth/auth.guard.js";
import { AUTH_PROVIDER, PRISMA } from "./auth/auth.tokens.js";
import { buildPlatformRuntime } from "./core/build-verse-core.js";
import { BUS } from "./core/bus.tokens.js";
import { VERSE_CORE } from "./core/core.tokens.js";
import { HealthController } from "./health/health.controller.js";
import { MeController } from "./me/me.controller.js";
import { RunsModule } from "./runs/runs.module.js";
import { LlmModule } from "./llm/llm.module.js";
import { PersonaModule } from "./persona/persona.module.js";
import { MemoryModule } from "./memory/memory.module.js";
import { ToolsModule } from "./tools/tools.module.js";
import { GrantsModule } from "./grants/grants.module.js";
import { PackagesModule } from "./packages/packages.module.js";
import { WorkflowsModule } from "./workflows/workflows.module.js";
import { ConnectorsModule } from "./connectors/connectors.module.js";
import { TenancyModule } from "./tenancy/tenancy.module.js";
import { ClerkWebhookController } from "./webhooks/clerk-webhook.controller.js";

function buildAuthProvider(): AuthProvider {
  const providerName = process.env.AUTH_PROVIDER ?? "dev";
  if (providerName === "dev") {
    return createAuthProvider({
      provider: "dev",
      devAdapter: new DevAuthAdapter(),
    });
  }
  return createAuthProvider({ provider: "clerk" });
}

const platform = buildPlatformRuntime();

@Global()
@Module({
  imports: [
    TenancyModule,
    RunsModule,
    LlmModule,
    PersonaModule,
    MemoryModule,
    ToolsModule,
    GrantsModule,
    PackagesModule,
    WorkflowsModule,
    ConnectorsModule,
  ],
  controllers: [HealthController, AuthController, MeController, ClerkWebhookController],
  providers: [
    {
      provide: AUTH_PROVIDER,
      useFactory: buildAuthProvider,
    },
    {
      provide: PRISMA,
      useFactory: (): PrismaClient => createPrismaClient(),
    },
    {
      provide: BUS,
      useValue: platform.bus as Bus,
    },
    {
      provide: VERSE_CORE,
      useValue: platform.core as VerseCore,
    },
    AuthGuard,
  ],
  exports: [AUTH_PROVIDER, PRISMA, BUS, VERSE_CORE, AuthGuard, TenancyModule],
})
export class AppModule {}
