import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { orgRoleAtLeast } from "./role-hierarchy.js";

describe("org role hierarchy (Phase 06)", () => {
  it("OWNER > ADMIN > EDITOR > VIEWER", () => {
    assert.equal(orgRoleAtLeast("OWNER", "ADMIN"), true);
    assert.equal(orgRoleAtLeast("ADMIN", "ADMIN"), true);
    assert.equal(orgRoleAtLeast("EDITOR", "ADMIN"), false);
    assert.equal(orgRoleAtLeast("VIEWER", "EDITOR"), false);
    assert.equal(orgRoleAtLeast("EDITOR", "VIEWER"), true);
  });
});
