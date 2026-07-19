/**
 * Q1 — Prove boundary guards reject an intentional violation fixture.
 * Exits 0 only when ESLint reports the architecture allow-list violation.
 * Fixture lives under scripts/boundaries/fixtures/ (isolated from production).
 */
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const fixture = join(root, "scripts/boundaries/fixtures/as-agent/intentional-violation.ts");
const config = join(root, "scripts/boundaries/eslint.fixture.config.mjs");

const result = spawnSync(
  process.platform === "win32" ? "pnpm.cmd" : "pnpm",
  ["exec", "eslint", "--no-ignore", "--config", config, fixture],
  {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
  },
);

const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

if (result.status === 0) {
  console.error("boundaries:prove FAILED — intentional fixture was NOT rejected by ESLint.");
  console.error(output);
  process.exit(1);
}

const detected =
  /Architecture boundary violated/i.test(output) || /no-restricted-imports/i.test(output);

if (!detected) {
  console.error("boundaries:prove FAILED — ESLint failed without the expected boundary rule.");
  console.error(output);
  process.exit(1);
}

console.log("boundaries:prove OK — intentional agent violation fixture was rejected.");
process.exit(0);
