import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { startAgentRuntime, type RuntimeHandle } from "@at72-verse/agent-runtime";
import type { Bus } from "@at72-verse/bus";
import type { PrismaClient } from "@at72-verse/db";
import type { VerseCore } from "@at72-verse/verse-core";
import { PRISMA } from "../auth/auth.tokens.js";
import { BUS } from "./bus.tokens.js";
import { VERSE_CORE } from "./core.tokens.js";

/**
 * MVP deploy: run Adam (and siblings) inside the API process so a single Railway
 * service can execute chat runs. Disable with VERSE_EMBED_AGENT_RUNTIME=0 when a
 * dedicated agent-runtime service is deployed (ADR-001 / ADR-002 target).
 * Redeploy bump: OpenAI chat.completions metadata removed in verse-core.
 */
@Injectable()
export class AgentRuntimeHost implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AgentRuntimeHost.name);
  private handle: RuntimeHandle | undefined;

  constructor(
    @Inject(BUS) private readonly bus: Bus,
    @Inject(VERSE_CORE) private readonly core: VerseCore,
    @Inject(PRISMA) private readonly prisma: PrismaClient,
  ) {}

  async onModuleInit(): Promise<void> {
    if (process.env.VERSE_EMBED_AGENT_RUNTIME === "0") {
      this.logger.log("Embedded agent-runtime disabled (VERSE_EMBED_AGENT_RUNTIME=0)");
      return;
    }

    this.handle = await startAgentRuntime({
      bus: this.bus,
      core: this.core,
      prisma: this.prisma,
      consumerGroup: process.env.VERSE_AGENT_CONSUMER_GROUP ?? "api-embedded-runtime",
    });
    this.logger.log(
      `Embedded agent-runtime ready; agents: ${this.handle.agents.join(", ")}`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.handle) {
      await this.handle.stop();
      this.handle = undefined;
    }
  }
}
