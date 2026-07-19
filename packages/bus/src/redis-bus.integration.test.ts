/**
 * Redis Streams integration — runs when REDIS_URL is set (Decision X2).
 */
import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import type { BusMessage } from "@at72-verse/contracts";
import { RedisStreamsBus } from "./redis-streams-bus.js";
import { runsTopic } from "./topics.js";

const redisUrl = process.env.REDIS_URL;
const describeRedis = redisUrl ? describe : describe.skip;

function sampleMessage(overrides: Partial<BusMessage> = {}): BusMessage {
  return {
    event_id: crypto.randomUUID(),
    correlation_id: crypto.randomUUID(),
    causation_id: crypto.randomUUID(),
    tenant_id: "org_1",
    workspace_id: "ws_1",
    run_id: "run_1",
    timestamp: new Date().toISOString(),
    version: "1",
    event_type: "run.created",
    payload: { via: "redis" },
    ...overrides,
  };
}

async function waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error("timeout waiting for condition");
    }
    await new Promise((r) => setTimeout(r, 50));
  }
}

describeRedis("@at72-verse/bus RedisStreamsBus integration", () => {
  const buses: RedisStreamsBus[] = [];

  after(async () => {
    for (const b of buses) {
      await b.close();
    }
  });

  it("publish → subscribe delivers once for the same event_id", async () => {
    assert.ok(redisUrl);
    const topic = `${runsTopic("it")}.${Date.now()}`;
    const bus = new RedisStreamsBus({
      redisUrl,
      pollIntervalMs: 100,
      sendToDlqOnHandlerError: false,
    });
    buses.push(bus);
    await bus.connect();

    const eventId = crypto.randomUUID();
    let calls = 0;
    const unsub = await bus.subscribe({ topic, consumer_group: `g_${Date.now()}` }, async () => {
      calls += 1;
    });

    const msg = sampleMessage({ event_id: eventId });
    await bus.publish(msg, { topic });
    await bus.publish(msg, { topic });
    await waitFor(() => calls >= 1);
    await new Promise((r) => setTimeout(r, 400));
    assert.equal(calls, 1);
    await unsub();
  });
});
