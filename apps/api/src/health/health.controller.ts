import { Inject, Controller, Get } from "@nestjs/common";
import type { PrismaClient } from "@at72-verse/db";
import type { VerseCore } from "@at72-verse/verse-core";
import { PRISMA } from "../auth/auth.tokens.js";
import { VERSE_CORE } from "../core/core.tokens.js";

@Controller("health")
export class HealthController {
  constructor(
    @Inject(VERSE_CORE) private readonly core: VerseCore,
    @Inject(PRISMA) private readonly prisma: PrismaClient,
  ) {}

  @Get()
  health() {
    return {
      status: "ok",
      service: "at72-verse-api",
      phase: 14,
    };
  }

  /** DB connectivity + schema probe (deploy diagnostics). */
  @Get("db")
  async dbHealth() {
    try {
      const users = await this.prisma.user.count();
      const organizations = await this.prisma.organization.count();
      const memberships = await this.prisma.membership.count();
      const packages = await this.prisma.package.count();
      return { status: "ok", users, organizations, memberships, packages, build: "751b87f-gpt55" };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { status: "error", message };
    }
  }

  /** Structured Verse Core health (Phase 08 Decision M). */
  @Get("core")
  async coreHealth() {
    return this.core.health();
  }
}
