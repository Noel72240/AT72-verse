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
      build: "meta-pages-diagnostic",
      meta_login_config_id: Boolean(process.env.META_LOGIN_CONFIG_ID?.trim()),
      meta_oauth_scopes: [
        "public_profile",
        "pages_show_list",
        "pages_manage_posts",
        "pages_read_engagement",
        "instagram_basic",
        "instagram_content_publish",
      ],
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
      return {
        status: "ok",
        users,
        organizations,
        memberships,
        packages,
        build: "meta-pages-diagnostic",
      };
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
