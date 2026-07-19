import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { createKernelClient } from "@at72-verse/verse-kernel";
import { createVerseCore } from "./create-verse-core.js";
import { CORE_MODULE_MANIFEST } from "./modules/manifest.js";

const fixedContext = {
  run_id: "11111111-1111-4111-8111-111111111111",
  agent_id: "nova",
  organization_id: "22222222-2222-4222-8222-222222222222",
  workspace_id: "33333333-3333-4333-8333-333333333333",
  user_id: "44444444-4444-4444-8444-444444444444",
  trace_id: "55555555-5555-4555-8555-555555555555",
  span_id: "66666666-6666-4666-8666-666666666666",
} as const;

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      out.push(...listTsFiles(full));
    } else if (name.endsWith(".ts")) {
      out.push(full);
    }
  }
  return out;
}

describe("@at72-verse/verse-core Phase 08", () => {
  it("health() returns extensible structured report", async () => {
    const core = createVerseCore({ kernelBackend: "stub" });
    const report = await core.health();
    assert.equal(report.status, "ok");
    assert.ok(typeof report.version === "string");
    assert.ok(typeof report.uptime_ms === "number");
    assert.ok(report.started_at);
    assert.equal(report.kernel_backend, "stub");
    assert.equal(report.modules.length, CORE_MODULE_MANIFEST.length);
    assert.ok(report.adapters.length >= 6);
    // Memory Gateway adapter reports ok; other defaults remain noop
    assert.ok(report.adapters.some((a) => a.kind === "memory" && a.status === "ok"));
    assert.ok(report.adapters.filter((a) => a.kind !== "memory").every((a) => a.status === "noop"));
  });

  it("createKernelClient(backend=core) wires through Core adapters", async () => {
    const core = createVerseCore({ kernelBackend: "core" });
    const kernel = createKernelClient({
      context: { ...fixedContext },
      backend: "core",
      coreFactory: (ctx) => core.createKernelClient(ctx),
    });
    const completion = await kernel.llm.complete({
      profile: "core-demo",
      messages: [{ role: "user", content: "ping core" }],
    });
    assert.ok(completion.content.includes("core-noop"));
    const remembered = await kernel.memory.remember({
      scope: "run.working",
      content: "core memory note",
    });
    const recalled = await kernel.memory.recall({
      scope: "run.working",
      query: "core memory",
    });
    assert.equal(remembered.id, recalled[0]?.id);
    assert.equal(remembered.layer, "L1");
    assert.equal(remembered.trace_id, fixedContext.trace_id);
  });

  it("source tree contains no Adam / agent package imports", () => {
    const root = dirname(fileURLToPath(import.meta.url));
    const files = listTsFiles(root);
    const bannedImports = [
      /from\s+["']@at72-verse\/agents/,
      /from\s+["']agents\//,
      /from\s+["']@at72-verse\/agent/,
    ];
    const bannedAdamWord = /\badam\b/i;
    for (const file of files) {
      if (file.endsWith(".test.ts")) continue;
      const src = readFileSync(file, "utf8");
      for (const pattern of bannedImports) {
        assert.equal(pattern.test(src), false, `${file} matches banned pattern ${pattern}`);
      }
      // Persona seeds may reference agent_id "adam" (Phase 17) — not an agent package import.
      const isPersonaSeed = file.replace(/\\/g, "/").includes("/persona/");
      if (!isPersonaSeed) {
        assert.equal(
          bannedAdamWord.test(src),
          false,
          `${file} matches banned pattern ${bannedAdamWord}`,
        );
      }
    }
  });
});
