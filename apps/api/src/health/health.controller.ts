import { Inject, Controller, Get } from "@nestjs/common";
import type { VerseCore } from "@at72-verse/verse-core";
import { VERSE_CORE } from "../core/core.tokens.js";

@Controller("health")
export class HealthController {
  constructor(@Inject(VERSE_CORE) private readonly core: VerseCore) {}

  @Get()
  health() {
    return {
      status: "ok",
      service: "at72-verse-api",
      phase: 14,
    };
  }

  /** Structured Verse Core health (Phase 08 Decision M). */
  @Get("core")
  async coreHealth() {
    return this.core.health();
  }
}
