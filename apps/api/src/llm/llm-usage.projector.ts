import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import type { Bus, BusMessage, BusUnsubscribe } from "@at72-verse/bus";
import { llmTopic } from "@at72-verse/bus";
import type { LlmUsageRecordedPayload } from "@at72-verse/contracts";
import type { PrismaClient } from "@at72-verse/db";
import { PRISMA } from "../auth/auth.tokens.js";
import { BUS } from "../core/bus.tokens.js";

/**
 * AW2 — persist LLM usage events. Sole writer of llm_usages (API owns domain data).
 */
@Injectable()
export class LlmUsageProjectorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LlmUsageProjectorService.name);
  private unsub: BusUnsubscribe | undefined;

  constructor(
    @Inject(BUS) private readonly bus: Bus,
    @Inject(PRISMA) private readonly prisma: PrismaClient,
  ) {}

  async onModuleInit(): Promise<void> {
    const topic = llmTopic("usage");
    this.unsub = await this.bus.subscribe(
      { topic, consumer_group: "api-llm-usage-projector" },
      async (message) => {
        await this.onUsage(message);
      },
    );
    this.logger.log(`Subscribed to ${topic}`);
  }

  async onModuleDestroy(): Promise<void> {
    if (this.unsub) {
      await this.unsub();
      this.unsub = undefined;
    }
  }

  private async onUsage(message: BusMessage): Promise<void> {
    if (message.event_type !== "llm.usage.recorded") {
      return;
    }
    const payload = message.payload as unknown as LlmUsageRecordedPayload;
    try {
      await this.persist(payload);
    } catch (err) {
      this.logger.error(
        `Failed to persist llm usage ${payload.llm_call_id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private async persist(payload: LlmUsageRecordedPayload): Promise<void> {
    const run = await this.prisma.run.findFirst({
      where: {
        id: payload.run_id,
        organizationId: payload.organization_id,
      },
      select: { id: true },
    });

    await this.prisma.llmUsage.upsert({
      where: { llmCallId: payload.llm_call_id },
      create: {
        organizationId: payload.organization_id,
        workspaceId: payload.workspace_id,
        runId: run?.id ?? null,
        traceId: payload.trace_id,
        llmCallId: payload.llm_call_id,
        agentId: payload.agent_id,
        profile: payload.profile,
        provider: payload.provider,
        model: payload.model,
        inputTokens: payload.input_tokens,
        outputTokens: payload.output_tokens,
        credentialSource: payload.credential_source,
        estimatedUsd: payload.estimated_usd,
        pricingVersion: payload.pricing_version,
      },
      update: {},
    });
  }
}
