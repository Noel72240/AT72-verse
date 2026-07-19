/**
 * Phase 33 / ED3 — Kernel tools signatures remain the chokepoint entry.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

describe("Kernel chokepoint stability (ED3)", () => {
  it("ToolRuntime still owns Kernel.tools.execute gate comment", () => {
    const file = path.join(root, "packages/verse-core/src/tools/tool-runtime.ts");
    const src = readFileSync(file, "utf8");
    assert.match(src, /Kernel\.tools\.execute/);
    assert.match(src, /class ToolRuntime/);
  });

  it("agents dependency boundary script still present", () => {
    const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    assert.ok(pkg.scripts.boundaries?.includes("boundaries"));
  });
});
