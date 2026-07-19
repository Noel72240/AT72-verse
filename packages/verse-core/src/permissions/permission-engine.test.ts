/**
 * Permission Engine unit tests (Phase 20 / DN13).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FIRST_PARTY_CAPABILITY_DEFAULTS } from "@at72-verse/contracts";
import { KernelError } from "@at72-verse/verse-kernel";
import {
  buildCapabilityGrantSnapshot,
  PermissionEngine,
} from "./permission-engine.js";

const ORG = "44444444-4444-4444-8444-444444444444";
const WS = "55555555-5555-4555-8555-555555555555";

function snapshot(
  overrides: Array<{ kind: "agent" | "skill" | "tool"; capability_id: string; enabled: boolean }> = [],
) {
  const byKey = new Map(
    FIRST_PARTY_CAPABILITY_DEFAULTS.map((g) => [`${g.kind}:${g.capability_id}`, { ...g }]),
  );
  for (const o of overrides) {
    byKey.set(`${o.kind}:${o.capability_id}`, o);
  }
  return buildCapabilityGrantSnapshot({
    organization_id: ORG,
    workspace_id: WS,
    grants: [...byKey.values()],
    captured_at: "2026-07-19T12:00:00.000Z",
  });
}

describe("PermissionEngine Phase 20", () => {
  const engine = new PermissionEngine();

  it("allows adam when workspace grant enabled", () => {
    const d = engine.evaluateAgentRun({ agent_id: "adam", grants_snapshot: snapshot() });
    assert.equal(d.allowed, true);
    assert.deepEqual(d.reasons, []);
  });

  it("denies agent with agent_disabled", () => {
    const d = engine.evaluateAgentRun({
      agent_id: "adam",
      grants_snapshot: snapshot([{ kind: "agent", capability_id: "adam", enabled: false }]),
    });
    assert.equal(d.allowed, false);
    assert.deepEqual(d.reasons, ["agent_disabled"]);
  });

  it("denies agent when grants_snapshot missing", () => {
    const d = engine.evaluateAgentRun({ agent_id: "adam" });
    assert.equal(d.allowed, false);
    assert.deepEqual(d.reasons, ["grants_snapshot_missing"]);
  });

  it("allows skill.writing when enabled", () => {
    const d = engine.evaluateSkillInvoke({
      skill_id: "skill.writing",
      grants_snapshot: snapshot(),
    });
    assert.equal(d.allowed, true);
  });

  it("denies skill with skill_disabled", () => {
    const d = engine.evaluateSkillInvoke({
      skill_id: "skill.writing",
      grants_snapshot: snapshot([
        { kind: "skill", capability_id: "skill.writing", enabled: false },
      ]),
    });
    assert.equal(d.allowed, false);
    assert.deepEqual(d.reasons, ["skill_disabled"]);
  });

  it("allows web-search under Persona ∩ allowlist ∩ grant", () => {
    const d = engine.evaluateToolExecute({
      tool_id: "web-search",
      side_effect: false,
      persona_tools: ["web-search", "file-read-write"],
      agent_allowlist: ["web-search", "file-read-write"],
      grants_snapshot: snapshot(),
    });
    assert.equal(d.allowed, true);
  });

  it("denies file-read-write when workspace grant disabled (DN12)", () => {
    const d = engine.evaluateToolExecute({
      tool_id: "file-read-write",
      side_effect: true,
      persona_tools: ["web-search", "file-read-write"],
      agent_allowlist: ["web-search", "file-read-write"],
      grants_snapshot: snapshot(),
    });
    assert.equal(d.allowed, false);
    assert.ok(d.reasons.includes("workspace_grant_disabled"));
    assert.ok(d.reasons.includes("side_effect_requires_explicit_grant"));
  });

  it("denies tool outside Persona", () => {
    const d = engine.evaluateToolExecute({
      tool_id: "web-search",
      side_effect: false,
      persona_tools: [],
      agent_allowlist: ["web-search"],
      grants_snapshot: snapshot(),
    });
    assert.equal(d.allowed, false);
    assert.deepEqual(d.reasons, ["persona_missing_tool"]);
  });

  it("denies tool outside agent allowlist", () => {
    const d = engine.evaluateToolExecute({
      tool_id: "web-search",
      side_effect: false,
      persona_tools: ["web-search"],
      agent_allowlist: [],
      grants_snapshot: snapshot(),
    });
    assert.equal(d.allowed, false);
    assert.deepEqual(d.reasons, ["agent_allowlist"]);
  });

  it("assertAllowed throws FORBIDDEN with reasons", () => {
    const d = engine.evaluateAgentRun({ agent_id: "adam" });
    assert.throws(
      () => engine.assertAllowed(d, "blocked"),
      (err: unknown) =>
        err instanceof KernelError &&
        err.code === "FORBIDDEN" &&
        Array.isArray(err.details?.reasons),
    );
  });

  it("buildCapabilityGrantSnapshot sorts deterministically", () => {
    const a = buildCapabilityGrantSnapshot({
      organization_id: ORG,
      workspace_id: WS,
      grants: [
        { kind: "tool", capability_id: "web-search", enabled: true },
        { kind: "agent", capability_id: "adam", enabled: true },
      ],
      captured_at: "2026-07-19T12:00:00.000Z",
    });
    assert.equal(a.grants[0]!.kind, "agent");
    assert.equal(a.grants[1]!.kind, "tool");
  });
});
