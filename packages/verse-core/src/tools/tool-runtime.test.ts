/**
 * Tool Runtime unit tests (Phase 19 + Phase 20 grants).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FIRST_PARTY_CAPABILITY_DEFAULTS,
  type KernelContext,
  type ToolSpec,
} from "@at72-verse/contracts";
import { KernelError } from "@at72-verse/verse-kernel";
import { PersonaEngine } from "../persona/persona-engine.js";
import { buildCapabilityGrantSnapshot } from "../permissions/permission-engine.js";
import { buildPackagesSnapshotFromSeeds } from "../registry/package-install-gate.js";
import { InMemoryToolExecutionAudit } from "./tool-audit-port.js";
import type { ToolHostPort } from "./tool-host-port.js";
import { ToolRuntime } from "./tool-runtime.js";

function defaultGrants() {
  return buildCapabilityGrantSnapshot({
    organization_id: "44444444-4444-4444-8444-444444444444",
    workspace_id: "55555555-5555-4555-8555-555555555555",
    grants: [...FIRST_PARTY_CAPABILITY_DEFAULTS],
    captured_at: "2026-07-19T12:00:00.000Z",
  });
}

const WEB_SPEC: ToolSpec = {
  id: "web-search",
  version: "0.1.0",
  description: "test",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["query"],
    properties: { query: { type: "string", minLength: 1 } },
  },
  output_schema: {
    type: "object",
    additionalProperties: false,
    required: ["results"],
    properties: {
      results: { type: "array" },
    },
  },
  side_effect: false,
  auth: { type: "none" },
  timeout_ms: 5000,
  permission: "tool.execute:web-search",
};

function ctx(partial: Partial<KernelContext> = {}): KernelContext {
  return {
    run_id: partial.run_id ?? "11111111-1111-4111-8111-111111111111",
    trace_id: partial.trace_id ?? "22222222-2222-4222-8222-222222222222",
    span_id: partial.span_id ?? "33333333-3333-4333-8333-333333333333",
    agent_id: partial.agent_id ?? "nova",
    organization_id: partial.organization_id ?? "44444444-4444-4444-8444-444444444444",
    tenant_id: partial.organization_id ?? "44444444-4444-4444-8444-444444444444",
    workspace_id: partial.workspace_id ?? "55555555-5555-4555-8555-555555555555",
    user_id: partial.user_id ?? null,
    step_id: partial.step_id ?? "66666666-6666-4666-8666-666666666666",
    tools_allowlist: partial.tools_allowlist ?? ["web-search", "file-read-write"],
    grants_snapshot:
      partial.grants_snapshot === undefined ? defaultGrants() : partial.grants_snapshot,
    packages_snapshot:
      partial.packages_snapshot === undefined
        ? buildPackagesSnapshotFromSeeds("44444444-4444-4444-8444-444444444444", {
            captured_at: "2026-07-19T12:00:00.000Z",
          })
        : partial.packages_snapshot,
  };
}

function host(): ToolHostPort {
  return {
    async resolve(id) {
      if (id !== "web-search") {
        throw new KernelError("NOT_FOUND", `missing ${id}`);
      }
      return { id, version: WEB_SPEC.version, spec: WEB_SPEC };
    },
    async execute(_id, c) {
      return {
        results: [
          {
            title: `Hit ${c.input.query}`,
            url: "https://example.com",
            snippet: "ok",
          },
        ],
      };
    },
    async listRegistered() {
      return ["web-search", "file-read-write"];
    },
  };
}

describe("ToolRuntime Phase 19", () => {
  it("executes allowed tool and audits completion with execution_id + step_id", async () => {
    const audit = new InMemoryToolExecutionAudit();
    const runtime = new ToolRuntime({
      host: host(),
      personaEngine: new PersonaEngine(),
      audit,
    });
    const result = await runtime.execute(
      { tool_id: "web-search", input: { query: "Verse" } },
      ctx(),
    );
    assert.ok(result.execution_id);
    assert.equal(Array.isArray(result.output.results), true);
    assert.equal(audit.entries.length, 1);
    assert.equal(audit.entries[0]!.status, "completed");
    assert.equal(audit.entries[0]!.step_id, "66666666-6666-4666-8666-666666666666");
    assert.equal(audit.entries[0]!.tool_version, "0.1.0");
  });

  it("forbids tool outside Persona ∩ Agent allowlist and still audits", async () => {
    const audit = new InMemoryToolExecutionAudit();
    const runtime = new ToolRuntime({
      host: host(),
      personaEngine: new PersonaEngine(),
      audit,
    });
    await assert.rejects(
      () =>
        runtime.execute(
          { tool_id: "web-search", input: { query: "x" } },
          ctx({ tools_allowlist: [] }),
        ),
      (err: unknown) => err instanceof KernelError && err.code === "FORBIDDEN",
    );
    assert.equal(audit.entries.length, 1);
    assert.equal(audit.entries[0]!.status, "forbidden");
  });

  it("listAvailable returns intersection only", async () => {
    const runtime = new ToolRuntime({
      host: host(),
      personaEngine: new PersonaEngine(),
      audit: new InMemoryToolExecutionAudit(),
    });
    const listed = await runtime.listAvailable(ctx({ tools_allowlist: ["web-search"] }));
    assert.deepEqual(listed, ["web-search"]);
  });
});

describe("ToolRuntime Phase 28b OAuth live", () => {
  const SOCIAL_SPEC: ToolSpec = {
    id: "social-publish",
    version: "0.2.0",
    description: "test",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["platform", "content"],
      properties: {
        platform: { type: "string" },
        content: { type: "string" },
        mode: { type: "string" },
      },
    },
    output_schema: {
      type: "object",
      additionalProperties: true,
      required: ["mode", "platform"],
      properties: {
        mode: { type: "string" },
        platform: { type: "string" },
        published: { type: "boolean" },
        would_publish: { type: "boolean" },
        external_post_id: { type: "string" },
        published_at: { type: "string" },
      },
    },
    side_effect: true,
    auth: { type: "oauth" },
    timeout_ms: 5000,
    permission: "tool.execute:social-publish",
  };

  function socialHost(capture: { oauth?: unknown }): ToolHostPort {
    return {
      async resolve(id) {
        if (id !== "social-publish") throw new KernelError("NOT_FOUND", id);
        return { id, version: SOCIAL_SPEC.version, spec: SOCIAL_SPEC };
      },
      async execute(_id, c) {
        capture.oauth = c.oauth;
        if (c.input.mode === "live") {
          return {
            mode: "live",
            published: true,
            platform: "linkedin",
            external_post_id: "urn:li:share:x",
            published_at: "2026-07-19T12:00:00.000Z",
          };
        }
        return {
          mode: "dry_run",
          would_publish: true,
          platform: "linkedin",
          content: String(c.input.content),
        };
      },
      async listRegistered() {
        return ["social-publish"];
      },
    };
  }

  it("mode live without connector throws CONNECTOR_NOT_CONNECTED", async () => {
    const capture: { oauth?: unknown } = {};
    const runtime = new ToolRuntime({
      host: socialHost(capture),
      personaEngine: new PersonaEngine(),
      audit: new InMemoryToolExecutionAudit(),
    });
    await assert.rejects(
      () =>
        runtime.execute(
          {
            tool_id: "social-publish",
            input: { platform: "linkedin", content: "hi", mode: "live" },
          },
          ctx({
            agent_id: "pulse",
            tools_allowlist: ["social-publish"],
          }),
        ),
      (err: unknown) =>
        err instanceof KernelError && err.code === "CONNECTOR_NOT_CONNECTED",
    );
    assert.equal(capture.oauth, undefined);
  });

  it("mode live with resolveAccessToken injects oauth into tool ctx", async () => {
    const capture: { oauth?: unknown } = {};
    const runtime = new ToolRuntime({
      host: socialHost(capture),
      personaEngine: new PersonaEngine(),
      audit: new InMemoryToolExecutionAudit(),
      oauthConnector: {
        async resolveAccessToken() {
          return "stub-access-live";
        },
      } as import("../connectors/oauth-connector.js").OAuthConnector,
    });
    const result = await runtime.execute(
      {
        tool_id: "social-publish",
        input: { platform: "linkedin", content: "hi", mode: "live" },
      },
      ctx({
        agent_id: "pulse",
        tools_allowlist: ["social-publish"],
      }),
    );
    assert.equal(result.output.mode, "live");
    assert.equal((capture.oauth as { access_token: string }).access_token, "stub-access-live");
  });

  it("without mode live does not resolve oauth", async () => {
    const capture: { oauth?: unknown } = {};
    const runtime = new ToolRuntime({
      host: socialHost(capture),
      personaEngine: new PersonaEngine(),
      audit: new InMemoryToolExecutionAudit(),
      oauthConnector: {
        async resolveAccessToken() {
          throw new Error("should not be called");
        },
      } as import("../connectors/oauth-connector.js").OAuthConnector,
    });
    const result = await runtime.execute(
      {
        tool_id: "social-publish",
        input: { platform: "linkedin", content: "hi" },
      },
      ctx({
        agent_id: "pulse",
        tools_allowlist: ["social-publish"],
      }),
    );
    assert.equal(result.output.mode, "dry_run");
    assert.equal(capture.oauth, undefined);
  });
});
