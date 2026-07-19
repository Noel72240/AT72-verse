/**
 * Phase 33 / ED9 — lightweight secret pattern scan (no network).
 * Fails if high-confidence secret patterns appear outside allowlisted paths.
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  ".next",
  "coverage",
]);

const ALLOW_SUFFIXES = ["docs/backup-restore-runbook.md", ".env.example"];

const PATTERNS = [
  { name: "sk_live", re: /sk_live_[0-9a-zA-Z]{16,}/ },
  { name: "sk_test_long", re: /sk_test_[0-9a-zA-Z]{24,}/ },
  { name: "private_key_block", re: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/ },
  { name: "aws_access_key", re: /AKIA[0-9A-Z]{16}/ },
];

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const full = path.join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (/\.(ts|tsx|js|mjs|cjs|md|json|yml|yaml|env|sql)$/i.test(name)) out.push(full);
  }
}

describe("secret pattern scan (ED9)", () => {
  it("finds no high-confidence secrets in source tree", () => {
    const files = [];
    walk(root, files);
    const hits = [];
    for (const file of files) {
      const rel = path.relative(root, file).replace(/\\/g, "/");
      if (ALLOW_SUFFIXES.some((a) => rel.endsWith(a))) continue;
      let text;
      try {
        text = readFileSync(file, "utf8");
      } catch {
        continue;
      }
      for (const { name, re } of PATTERNS) {
        if (re.test(text)) hits.push(`${rel} (${name})`);
      }
    }
    assert.deepEqual(hits, [], `Unexpected secret-like patterns:\n${hits.join("\n")}`);
  });
});
