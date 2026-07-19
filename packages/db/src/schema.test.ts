/**
 * Schema / export smoke tests (no database required).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { OrgRole, WorkspaceRole, packageName } from "./index.js";

describe("@at72-verse/db schema exports", () => {
  it("exports packageName", () => {
    assert.equal(packageName, "@at72-verse/db");
  });

  it("exposes OrgRole and WorkspaceRole enums (Phase 06 role set)", () => {
    assert.equal(OrgRole.OWNER, "OWNER");
    assert.equal(OrgRole.ADMIN, "ADMIN");
    assert.equal(OrgRole.EDITOR, "EDITOR");
    assert.equal(OrgRole.VIEWER, "VIEWER");
    assert.equal(WorkspaceRole.OWNER, "OWNER");
    assert.equal(WorkspaceRole.VIEWER, "VIEWER");
  });
});
