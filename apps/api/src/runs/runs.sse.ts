/**
 * SSE helpers for run progress streaming (Phase 16 / CE1).
 * Business events only — no token streaming.
 */
import type { Response } from "express";

export type RunStreamEventType =
  | "snapshot"
  | "step_created"
  | "status_changed"
  | "run_completed"
  | "run_failed"
  | "heartbeat";

export function initSseResponse(res: Response): void {
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
}

export function writeSseEvent(
  res: Response,
  type: RunStreamEventType,
  data: Record<string, unknown>,
  id?: string,
): void {
  if (id) {
    res.write(`id: ${id}\n`);
  }
  res.write(`event: ${type}\n`);
  res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
}
