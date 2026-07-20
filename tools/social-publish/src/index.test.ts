import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { execute, setLinkedInPublishPortForTests } from "./index.js";
import { KernelError } from "@at72-verse/verse-kernel";

describe("social-publish Phase 28b", () => {
  it("defaults to dry-run without mode live", async () => {
    const out = await execute({
      input: { platform: "linkedin", content: "Hello Verse" },
      organization_id: "o",
      workspace_id: "w",
      run_id: "r",
      agent_id: "pulse",
    });
    assert.equal(out.mode, "dry_run");
    assert.equal(out.would_publish, true);
  });

  it("live with injected oauth publishes via port (no token in output)", async () => {
    setLinkedInPublishPortForTests({
      async publishMemberPost(input) {
        assert.equal(input.access_token, "stub-access-test");
        return { external_post_id: "urn:li:share:test-1" };
      },
    });
    try {
      const out = await execute({
        input: { platform: "linkedin", content: "Live post", mode: "live" },
        organization_id: "o",
        workspace_id: "w",
        run_id: "r",
        agent_id: "pulse",
        oauth: { provider: "linkedin", access_token: "stub-access-test" },
      });
      assert.equal(out.mode, "live");
      assert.equal(out.published, true);
      assert.equal(out.external_post_id, "urn:li:share:test-1");
      assert.equal(JSON.stringify(out).includes("stub-access"), false);
    } finally {
      setLinkedInPublishPortForTests(null);
    }
  });

  it("live Instagram stub publishes with image_url", async () => {
    const out = await execute({
      input: {
        platform: "instagram",
        content: "Hello IG",
        mode: "live",
        image_url: "https://example.com/photo.jpg",
      },
      organization_id: "o",
      workspace_id: "w",
      run_id: "r",
      agent_id: "pulse",
      oauth: {
        provider: "instagram",
        access_token: "stub-access-ig",
        ig_user_id: "stub-ig-1",
      },
    });
    assert.equal(out.mode, "live");
    assert.equal(out.published, true);
    assert.equal(out.platform, "instagram");
    assert.match(String(out.external_post_id), /^ig_stub_/);
  });

  it("live without oauth throws CONNECTOR_NOT_CONNECTED", async () => {
    await assert.rejects(
      () =>
        execute({
          input: { platform: "linkedin", content: "x", mode: "live" },
          organization_id: "o",
          workspace_id: "w",
          run_id: "r",
          agent_id: "pulse",
        }),
      (err: unknown) => err instanceof KernelError && err.code === "CONNECTOR_NOT_CONNECTED",
    );
  });
});
