/**
 * @at72-verse/tool-social-publish — Phase 27a dry-run · Phase 28b live LinkedIn
 * Token never read from env/agents — only ctx.oauth injected by Core ToolRuntime.
 */
import type { ToolExecuteContext, ToolSpec } from "@at72-verse/contracts";
import { KernelError } from "@at72-verse/verse-kernel";

export const TOOL_ID = "social-publish" as const;

export const SOCIAL_PUBLISH_TOOL_SPEC: ToolSpec = {
  id: TOOL_ID,
  version: "0.2.0",
  description:
    "Publish a social post. Default dry-run; mode=live requires Core-injected OAuth (LinkedIn).",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["platform", "content"],
    properties: {
      platform: { type: "string", minLength: 1 },
      content: { type: "string", minLength: 1 },
      scheduled_at: { type: "string" },
      mode: { type: "string", enum: ["dry_run", "live"] },
    },
  },
  output_schema: {
    type: "object",
    additionalProperties: false,
    required: ["mode", "platform"],
    properties: {
      mode: { type: "string" },
      would_publish: { type: "boolean" },
      published: { type: "boolean" },
      platform: { type: "string" },
      content: { type: "string" },
      scheduled_at: { type: "string" },
      external_post_id: { type: "string" },
      published_at: { type: "string" },
    },
  },
  side_effect: true,
  auth: { type: "oauth" },
  timeout_ms: 15000,
  permission: "tool.execute:social-publish",
  categories: ["social"],
  package: { kind: "tool", package_id: "pkg.tool.social-publish" },
};

export const toolSpec = SOCIAL_PUBLISH_TOOL_SPEC;

export type LinkedInPublishPort = {
  publishMemberPost(input: {
    access_token: string;
    content: string;
  }): Promise<{ external_post_id: string }>;
};

function isStubToken(token: string): boolean {
  return token.startsWith("stub-access-") || process.env.VERSE_OAUTH_STUB === "1";
}

export async function defaultLinkedInPublish(input: {
  access_token: string;
  content: string;
  fetchImpl?: typeof fetch;
}): Promise<{ external_post_id: string }> {
  if (isStubToken(input.access_token)) {
    return { external_post_id: `urn:li:share:stub-${Date.now()}` };
  }

  const fetchImpl = input.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const meRes = await fetchImpl("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${input.access_token}` },
  });
  if (!meRes.ok) {
    throw new KernelError("PROVIDER_ERROR", "LinkedIn userinfo failed", {
      details: { status: meRes.status },
      retryable: meRes.status === 429,
    });
  }
  const me = (await meRes.json()) as { sub?: string };
  if (!me.sub) {
    throw new KernelError("PROVIDER_ERROR", "LinkedIn userinfo missing sub");
  }
  const author = me.sub.startsWith("urn:") ? me.sub : `urn:li:person:${me.sub}`;

  const body = {
    author,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: input.content },
        shareMediaCategory: "NONE",
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  };

  const postRes = await fetchImpl("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.access_token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });
  if (!postRes.ok) {
    throw new KernelError("PROVIDER_ERROR", "LinkedIn ugcPosts failed", {
      details: { status: postRes.status },
      retryable: postRes.status === 429,
    });
  }
  const idHeader = postRes.headers.get("x-restli-id") ?? postRes.headers.get("X-RestLi-Id");
  const json = (await postRes.json().catch(() => ({}))) as { id?: string };
  const external_post_id = idHeader ?? json.id ?? `urn:li:share:unknown`;
  return { external_post_id };
}

let linkedInPublish: LinkedInPublishPort = {
  publishMemberPost: (input) => defaultLinkedInPublish(input),
};

/** Test-only seam — not used by Agents/Runtime. */
export function setLinkedInPublishPortForTests(port: LinkedInPublishPort | null): void {
  linkedInPublish = port ?? {
    publishMemberPost: (input) => defaultLinkedInPublish(input),
  };
}

export async function execute(ctx: ToolExecuteContext): Promise<Record<string, unknown>> {
  const platform = String(ctx.input.platform ?? "").trim();
  const content = String(ctx.input.content ?? "").trim();
  const scheduled_at =
    typeof ctx.input.scheduled_at === "string" && ctx.input.scheduled_at.trim().length > 0
      ? ctx.input.scheduled_at.trim()
      : undefined;
  const mode = ctx.input.mode === "live" ? "live" : "dry_run";

  if (mode !== "live") {
    return {
      mode: "dry_run",
      would_publish: true,
      platform,
      content,
      ...(scheduled_at ? { scheduled_at } : {}),
    };
  }

  const token = ctx.oauth?.access_token;
  if (!token) {
    throw new KernelError(
      "CONNECTOR_NOT_CONNECTED",
      "OAuth access token missing for live publish",
      { details: { code: "CONNECTOR_NOT_CONNECTED" } },
    );
  }

  const platformKey = platform.toLowerCase();

  if (platformKey === "linkedin") {
    const published = await linkedInPublish.publishMemberPost({
      access_token: token,
      content,
    });
    return {
      mode: "live",
      published: true,
      platform: "linkedin",
      external_post_id: published.external_post_id,
      published_at: new Date().toISOString(),
    };
  }

  if (platformKey === "facebook") {
    const pageId = ctx.oauth?.page_id;
    if (!pageId) {
      throw new KernelError(
        "INVALID_INPUT",
        "No Facebook Page selected — reconnect Meta and choose AlloTech72 on /connectors",
        { details: { code: "META_PAGE_REQUIRED" } },
      );
    }
    const published = await publishFacebookPagePost({
      access_token: token,
      page_id: pageId,
      content,
    });
    return {
      mode: "live",
      published: true,
      platform: "facebook",
      external_post_id: published.external_post_id,
      published_at: new Date().toISOString(),
    };
  }

  if (platformKey === "instagram") {
    const igUserId = ctx.oauth?.ig_user_id;
    if (!igUserId) {
      throw new KernelError(
        "INVALID_INPUT",
        "No Instagram Business account linked to the selected Facebook Page",
        { details: { code: "IG_USER_REQUIRED" } },
      );
    }
    throw new KernelError(
      "NOT_IMPLEMENTED",
      "Live Instagram publish needs an image URL (Graph API). Facebook Page text posts work now — IG media publish arrives next.",
      { details: { code: "IG_MEDIA_REQUIRED", ig_user_id: igUserId } },
    );
  }

  throw new KernelError(
    "NOT_IMPLEMENTED",
    `Live social-publish for ${platform} is not available yet`,
    { details: { platform, code: "LIVE_PUBLISH_PLATFORM_PENDING" } },
  );
}

async function publishFacebookPagePost(input: {
  access_token: string;
  page_id: string;
  content: string;
  fetchImpl?: typeof fetch;
}): Promise<{ external_post_id: string }> {
  if (isStubToken(input.access_token) || input.page_id.startsWith("stub-")) {
    return { external_post_id: `fb_stub_${Date.now()}` };
  }
  const fetchImpl = input.fetchImpl ?? globalThis.fetch.bind(globalThis);
  const u = new URL(`https://graph.facebook.com/v21.0/${encodeURIComponent(input.page_id)}/feed`);
  const body = new URLSearchParams({
    message: input.content,
    access_token: input.access_token,
  });
  const res = await fetchImpl(u.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new KernelError("PROVIDER_ERROR", "Facebook Page feed publish failed", {
      details: { status: res.status },
      retryable: res.status === 429,
    });
  }
  const json = (await res.json()) as { id?: string };
  return { external_post_id: json.id ?? `fb_${Date.now()}` };
}

export const packageName = "@at72-verse/tool-social-publish" as const;
