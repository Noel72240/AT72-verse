import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AgentManifest } from "./agents/agent-manifest.js";
import type { BusMessage, MessageEnvelope } from "./bus/bus-message.js";
import type { KernelClient } from "./kernel/kernel-api.js";
import { canTransitionRunStatus } from "./runs/run.js";
import {
  CONTRACT_SCHEMA_FILES,
  validateAgainstSchema,
  validateAllExamples,
} from "./validation/validate-examples.js";

describe("@at72-verse/contracts freeze v0", () => {
  it("exports MessageEnvelope as an alias of BusMessage", () => {
    const message: BusMessage = {
      event_id: "e1",
      correlation_id: "c1",
      causation_id: "a1",
      tenant_id: "t1",
      workspace_id: "w1",
      run_id: null,
      timestamp: "2026-07-18T10:00:00.000Z",
      version: "1.0.0",
      event_type: "ping",
      payload: {},
    };
    const alias: MessageEnvelope = message;
    assert.equal(alias.event_type, "ping");
  });

  it("accepts a typed AgentManifest matching architecture fields", () => {
    const nova: AgentManifest = {
      id: "nova",
      name: "Nova",
      version: "0.1.0",
      role: "content_creation",
      description: "Content creation specialist",
      kind: "specialist",
      default_persona: "persona.nova.default",
      skills: ["skill.writing"],
      tools_allowlist: ["web-search"],
      memory_scopes: ["run.working"],
      default_model_profile: "creative-balanced",
      constraints: {
        max_tokens_per_run: 1000,
        max_tool_calls: 5,
        max_skill_invocations: 5,
        timeout_ms: 10000,
      },
    };
    assert.equal(nova.kind, "specialist");
  });

  it("defines KernelClient syscall families (ADR-002 stubs)", () => {
    const keys: Array<keyof KernelClient> = [
      "context",
      "llm",
      "memory",
      "tools",
      "skills",
      "persona",
      "orchestration",
      "events",
      "artifacts",
      "cost",
      "registry",
      "files",
    ];
    assert.equal(keys.length, 12);
  });

  it("enforces Phase 11 run status transitions", () => {
    assert.equal(canTransitionRunStatus("queued", "running"), true);
    assert.equal(canTransitionRunStatus("queued", "completed"), false);
    assert.equal(canTransitionRunStatus("running", "completed"), true);
    assert.equal(canTransitionRunStatus("completed", "failed"), false);
  });

  it("validates every freeze-v0 example against its JSON Schema", () => {
    const results = validateAllExamples();
    assert.equal(results.length, Object.keys(CONTRACT_SCHEMA_FILES).length);
    for (const result of results) {
      assert.equal(result.ok, true, result.ok ? undefined : `${result.schemaId}: ${result.errors}`);
    }
  });

  it("rejects an invalid BusMessage missing required fields", () => {
    const result = validateAgainstSchema("bus-message", {
      event_id: "only-one-field",
    });
    assert.equal(result.ok, false);
  });
});
