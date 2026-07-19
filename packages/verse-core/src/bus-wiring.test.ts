import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { agentTasksTopic, createBus } from "@at72-verse/bus";
import { createBusPortAdapter } from "./adapters/bus-port.js";
import { createNoopAdapters } from "./adapters/noop.js";
import { createVerseCore } from "./create-verse-core.js";

describe("Verse Core Bus wiring Phase 10", () => {
  it("createVerseCore({ bus }) reports package-bus adapter health", async () => {
    const bus = createBus({ backend: "memory" });
    const core = createVerseCore({ bus, kernelBackend: "stub" });
    const health = await core.health();
    const busHealth = health.adapters.find((a) => a.kind === "bus");
    assert.equal(busHealth?.status, "ok");
    assert.equal(busHealth?.name, "package-bus");
  });

  it("BusPortAdapter publishes through InMemoryBus", async () => {
    const bus = createBus({ backend: "memory" });
    const adapter = createBusPortAdapter(bus);
    const topic = agentTasksTopic("nova");
    let seen = 0;
    await bus.subscribe({ topic, consumer_group: "core-test" }, async () => {
      seen += 1;
    });
    await adapter.publish(
      topic,
      { note: "from-core" },
      {
        run_id: "run_1",
        trace_id: "trace_1",
        span_id: "span_1",
        agent_id: "nova",
        organization_id: "org_1",
        tenant_id: "org_1",
        workspace_id: "ws_1",
        user_id: null,
      },
    );
    assert.equal(seen, 1);
    assert.equal(createNoopAdapters().bus.name, "noop-bus");
  });
});
