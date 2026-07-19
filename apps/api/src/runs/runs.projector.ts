import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import type { Bus, BusMessage, BusUnsubscribe } from "@at72-verse/bus";
import { agentEventsTopic } from "@at72-verse/bus";
import type {
  AgentTaskCompletedPayload,
  AgentTaskConsultedPayload,
  AgentTaskDelegatedPayload,
} from "@at72-verse/contracts";
import { BUS } from "../core/bus.tokens.js";
import { RunsService } from "./runs.service.js";

/** Agents whose events are projected into Runs (extensible list). */
const PROJECTED_AGENTS = [
  "adam",
  "nova",
  "orion",
  "astra",
  "pixel",
  "pulse",
  "echo",
  "nexus",
  "vega",
  "neo",
  "kira",
  "nyx",
] as const;

/**
 * AI3 / AO1 / AP3 / Phase 15 / 24 — consume task.delegated + task.consulted + task.completed.
 * Sole writer path for agent-driven run mutations (via RunsService internals).
 */
@Injectable()
export class RunsProjectorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RunsProjectorService.name);
  private unsubs: BusUnsubscribe[] = [];

  constructor(
    @Inject(BUS) private readonly bus: Bus,
    private readonly runs: RunsService,
  ) {}

  async onModuleInit(): Promise<void> {
    for (const agentId of PROJECTED_AGENTS) {
      const topic = agentEventsTopic(agentId);
      const unsub = await this.bus.subscribe(
        { topic, consumer_group: "api-runs-projector" },
        async (message) => {
          await this.onAgentEvent(message);
        },
      );
      this.unsubs.push(unsub);
      this.logger.log(`Subscribed to ${topic}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    for (const u of this.unsubs) {
      await u();
    }
    this.unsubs = [];
  }

  private async onAgentEvent(message: BusMessage): Promise<void> {
    if (message.event_type === "task.delegated") {
      const payload = message.payload as AgentTaskDelegatedPayload;
      try {
        await this.runs.projectAgentTaskDelegated(payload);
      } catch (err) {
        this.logger.error(
          `Failed to project task.delegated for run ${payload.run_id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
      return;
    }

    if (message.event_type === "task.consulted") {
      const payload = message.payload as AgentTaskConsultedPayload;
      try {
        await this.runs.projectAgentTaskConsulted(payload);
      } catch (err) {
        this.logger.error(
          `Failed to project task.consulted for run ${payload.run_id}: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
      return;
    }

    if (message.event_type !== "task.completed") {
      return;
    }
    const payload = message.payload as AgentTaskCompletedPayload;
    try {
      await this.runs.projectAgentTaskCompleted(payload);
    } catch (err) {
      this.logger.error(
        `Failed to project task.completed for run ${payload.run_id}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
