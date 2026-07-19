/**
 * SSE run stream — reconnectable business-event feed (Phase 16 / CE1).
 * Snapshot on connect + live verse.runs.* filtered by run_id.
 */
import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { Inject } from "@nestjs/common";
import type { Bus, BusUnsubscribe } from "@at72-verse/bus";
import { runsTopic } from "@at72-verse/bus";
import { AuthGuard } from "../auth/auth.guard.js";
import type { RequestWithAuth } from "../auth/auth.tokens.js";
import { RbacGuard } from "../rbac/rbac.guard.js";
import { BUS } from "../core/bus.tokens.js";
import { RunsService } from "./runs.service.js";
import { initSseResponse, writeSseEvent } from "./runs.sse.js";

const STREAM_TOPICS = ["created", "step_created", "status_changed"] as const;

@Controller()
@UseGuards(AuthGuard, RbacGuard)
export class RunsStreamController {
  constructor(
    private readonly runs: RunsService,
    @Inject(BUS) private readonly bus: Bus,
  ) {}

  /**
   * GET /runs/:runId/stream
   * Client should: (1) restore state via REST on reconnect, (2) re-open this SSE.
   */
  @Get("runs/:runId/stream")
  async stream(
    @Req() req: RequestWithAuth,
    @Param("runId") runId: string,
    @Res() res: Response,
  ): Promise<void> {
    const userId = req.verseAuth!.user.id;
    let run;
    try {
      run = await this.runs.getRun(runId, userId);
    } catch {
      throw new NotFoundException({ code: "not_found", message: "Run not found" });
    }
    const steps = await this.runs.listSteps(runId, userId);

    initSseResponse(res);
    writeSseEvent(
      res,
      "snapshot",
      {
        run,
        steps,
      },
      `snapshot-${runId}`,
    );

    const connectedAt = Date.now();
    const unsubs: BusUnsubscribe[] = [];
    const onClose = async () => {
      for (const u of unsubs) {
        await u();
      }
    };
    const close = () => {
      void onClose();
    };
    req.on?.("close", close);

    for (const suffix of STREAM_TOPICS) {
      const topic = runsTopic(suffix);
      const unsub = await this.bus.subscribe(
        { topic, consumer_group: `sse-run-${runId}-${userId}-${Date.now()}` },
        async (message) => {
          if (message.run_id !== runId) return;
          // Skip bus replay of historical events (reconnect uses REST snapshot instead)
          const msgTs = Date.parse(message.timestamp);
          if (!Number.isNaN(msgTs) && msgTs + 500 < connectedAt) return;
          const payload = message.payload as Record<string, unknown>;
          if (suffix === "step_created") {
            writeSseEvent(
              res,
              "step_created",
              { run: payload.run, step: payload.step },
              message.event_id,
            );
          } else if (suffix === "status_changed") {
            const to = payload.to as string | undefined;
            if (to === "completed") {
              writeSseEvent(
                res,
                "run_completed",
                {
                  run: payload.run,
                  from: payload.from,
                  to,
                  message: payload.message ?? null,
                  result: payload.result ?? null,
                },
                message.event_id,
              );
            } else if (to === "failed") {
              writeSseEvent(
                res,
                "run_failed",
                {
                  run: payload.run,
                  from: payload.from,
                  to,
                  error: (payload.run as { error?: unknown } | undefined)?.error ?? null,
                },
                message.event_id,
              );
            } else {
              writeSseEvent(
                res,
                "status_changed",
                { run: payload.run, from: payload.from, to: payload.to },
                message.event_id,
              );
            }
          } else if (suffix === "created") {
            writeSseEvent(
              res,
              "status_changed",
              { run: payload.run, from: null, to: (payload.run as { status?: string })?.status },
              message.event_id,
            );
          }
        },
      );
      unsubs.push(unsub);
    }

    const heartbeat = setInterval(() => {
      if (res.writableEnded) {
        clearInterval(heartbeat);
        return;
      }
      writeSseEvent(res, "heartbeat", { ts: new Date().toISOString() });
    }, 15000);

    req.on?.("close", () => {
      clearInterval(heartbeat);
    });
  }
}
