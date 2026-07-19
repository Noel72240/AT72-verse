/**
 * file-read-write sandbox tests (Phase 19 / DM7).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { KernelError } from "@at72-verse/verse-kernel";
import {
  clearWorkspaceFiles,
  execute,
  resolveSandboxPath,
} from "./index.js";

describe("tool-file-read-write sandbox", () => {
  it("rejects path traversal", () => {
    assert.throws(
      () => resolveSandboxPath("../secret"),
      (err: unknown) => err instanceof KernelError && err.code === "FORBIDDEN",
    );
    assert.throws(
      () => resolveSandboxPath("/etc/passwd"),
      (err: unknown) => err instanceof KernelError && err.code === "FORBIDDEN",
    );
  });

  it("reads and writes inside workspace store", async () => {
    clearWorkspaceFiles();
    const ctx = {
      input: { op: "write", path: "notes/a.txt", content: "hello" },
      organization_id: "org",
      workspace_id: "ws",
      run_id: "run",
      agent_id: "nova",
    };
    const written = await execute(ctx);
    assert.equal(written.ok, true);
    const read = await execute({
      ...ctx,
      input: { op: "read", path: "notes/a.txt" },
    });
    assert.equal(read.content, "hello");
  });
});
