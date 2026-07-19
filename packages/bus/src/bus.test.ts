import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BusMessage } from "@at72-verse/contracts";
import { BusError } from "./errors.js";
import { InMemoryBus } from "./in-memory-bus.js";
import { agentTasksTopic, runsTopic, TOPIC_DLQ } from "./topics.js";

function sampleMessage(overrides: Partial<BusMessage> = {}): BusMessage {
  return {
    event_id: "11111111-1111-4111-8111-111111111111",
    correlation_id: "22222222-2222-4222-8222-222222222222",
    causation_id: "33333333-3333-4333-8333-333333333333",
    tenant_id: "org_1",
    workspace_id: "ws_1",
    run_id: "run_1",
    timestamp: "2026-07-18T12:00:00.000Z",
    version: "1",
    event_type: "run.created",
    payload: { hello: "world" },
    ...overrides,
  };
}

describe("@at72-verse/bus InMemoryBus Phase 10", () => {
  it("publish → subscribe delivers once (idempotent on event_id)", async () => {
    const bus = new InMemoryBus({ sendToDlqOnHandlerError: false });
    const topic = runsTopic("created");
    let calls = 0;
    await bus.subscribe({ topic, consumer_group: "g1" }, async () => {
      calls += 1;
    });

    const msg = sampleMessage();
    await bus.publish(msg, { topic });
    await bus.publish(msg, { topic });
    assert.equal(calls, 1);
  });

  it("rejects publish without schema version", async () => {
    const bus = new InMemoryBus();
    await assert.rejects(
      () =>
        bus.publish(sampleMessage({ version: "" }), {
          topic: runsTopic("created"),
        }),
      (err: unknown) => err instanceof BusError && err.code === "INVALID_MESSAGE",
    );
  });

  it("freezes messages after publish (immutable)", async () => {
    const bus = new InMemoryBus({ sendToDlqOnHandlerError: false });
    const topic = runsTopic("created");
    let received: BusMessage | undefined;
    await bus.subscribe({ topic, consumer_group: "g1" }, async (m) => {
      received = m;
    });
    await bus.publish(sampleMessage(), { topic });
    assert.ok(received);
    assert.throws(() => {
      (received as { event_type: string }).event_type = "mutated";
    });
  });

  it("preserves unknown envelope fields for forward-compatible handlers", async () => {
    const bus = new InMemoryBus({ sendToDlqOnHandlerError: false });
    const topic = agentTasksTopic("nova");
    let extra: unknown;
    await bus.subscribe({ topic, consumer_group: "g1" }, async (m) => {
      extra = (m as BusMessage & { future_field?: string }).future_field;
    });
    await bus.publish({ ...sampleMessage(), future_field: "keep-me" } as BusMessage, { topic });
    assert.equal(extra, "keep-me");
  });

  it("request and broadcast are explicit UNAVAILABLE stubs (T2)", async () => {
    const bus = new InMemoryBus();
    await assert.rejects(
      () => bus.request(sampleMessage(), { topic: runsTopic("x") }),
      (err: unknown) => err instanceof BusError && err.code === "UNAVAILABLE",
    );
    await assert.rejects(
      () => bus.broadcast(sampleMessage(), { topic: runsTopic("x") }),
      (err: unknown) => err instanceof BusError && err.code === "UNAVAILABLE",
    );
  });

  it("handler failure publishes DLQ with same BusMessage shape (W1)", async () => {
    const bus = new InMemoryBus({ sendToDlqOnHandlerError: true });
    const topic = runsTopic("failed-handler");
    const dlq: BusMessage[] = [];
    await bus.subscribe({ topic: TOPIC_DLQ, consumer_group: "dlq" }, async (m) => {
      dlq.push(m);
    });
    await bus.subscribe({ topic, consumer_group: "g1" }, async () => {
      throw new Error("boom");
    });
    await bus.publish(sampleMessage({ event_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }), {
      topic,
    });
    assert.equal(dlq.length, 1);
    assert.equal(dlq[0]?.version, "1");
    assert.equal(dlq[0]?.event_type, "system.dlq.dead_letter");
    assert.ok(dlq[0]?.payload.original);
    assert.equal(dlq[0]?.causation_id, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  });
});
