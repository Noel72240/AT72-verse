/**
 * @at72-verse/tool-social-publish — Phase 27a dry-run · Phase 28b live LinkedIn
 * Token never read from env/agents — only ctx.oauth injected by Core ToolRuntime.
 */
import type { ToolExecuteContext, ToolSpec } from "@at72-verse/contracts";
import { KernelError } from "@at72-verse/verse-kernel";

export const TOOL_ID = "social-publish" as const;

export const SOCIAL_PUBLISH_TOOL_SPEC: ToolSpec = {
  id: TOOL_ID,
  version: "0.3.0",
  description:
    "Publish a social post. Default dry-run; mode=live requires Core-injected OAuth (LinkedIn / Facebook Page / Instagram).",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["platform", "content"],
    properties: {
      platform: { type: "string", minLength: 1 },
      content: { type: "string", minLength: 1 },
      scheduled_at: { type: "string" },
      mode: { type: "string", enum: ["dry_run", "live"] },
      /** Required for live Instagram (public HTTPS image Meta can fetch). */
      image_url: { type: "string" },
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
      image_url: { type: "string" },
    },
  },
  side_effect: true,
  auth: { type: "oauth" },
  timeout_ms: 60000,
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
    const imageUrl = resolveInstagramImageUrl(ctx.input, content);
    if (!imageUrl) {
      throw new KernelError(
        "INVALID_INPUT",
        "Instagram live needs a public image URL (https://…). Add one in the message or set VERSE_IG_DEFAULT_IMAGE_URL.",
        { details: { code: "IG_MEDIA_REQUIRED", ig_user_id: igUserId } },
      );
    }
    const published = await publishInstagramFeedPost({
      access_token: token,
      ig_user_id: igUserId,
      caption: content,
      image_url: imageUrl,
    });
    return {
      mode: "live",
      published: true,
      platform: "instagram",
      external_post_id: published.external_post_id,
      published_at: new Date().toISOString(),
      image_url: imageUrl,
    };
  }

  throw new KernelError(
    "NOT_IMPLEMENTED",
    `Live social-publish for ${platform} is not available yet`,
    { details: { platform, code: "LIVE_PUBLISH_PLATFORM_PENDING" } },
  );
}

/** Prefer explicit input, then URL in caption, then env default. */
export function resolveInstagramImageUrl(
  input: Record<string, unknown>,
  content: string,
): string | null {
  const fromInput =
    typeof input.image_url === "string" && input.image_url.trim().startsWith("https://")
      ? input.image_url.trim()
      : null;
  if (fromInput) return fromInput;
  const fromContent = content.match(/https:\/\/[^\s<>"']+\.(?:jpg|jpeg|png|webp)(?:\?[^\s<>"']*)?/i);
  if (fromContent?.[0]) return fromContent[0];
  const fromEnv = process.env.VERSE_IG_DEFAULT_IMAGE_URL?.trim();
  if (fromEnv?.startsWith("https://")) return fromEnv;
  return null;
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
    const errBody = (await res.json().catch(() => ({}))) as {
      error?: { message?: string; code?: number; type?: string };
    };
    const fbMsg = errBody.error?.message ?? `HTTP ${res.status}`;
    throw new KernelError("PROVIDER_ERROR", `Facebook Page feed publish failed: ${fbMsg}`, {
      details: {
        status: res.status,
        facebook_error: errBody.error?.message ?? null,
        facebook_code: errBody.error?.code ?? null,
      },
      retryable: res.status === 429,
    });
  }
  const json = (await res.json()) as { id?: string };
  return { external_post_id: json.id ?? `fb_${Date.now()}` };
}

async function publishInstagramFeedPost(input: {
  access_token: string;
  ig_user_id: string;
  caption: string;
  image_url: string;
  fetchImpl?: typeof fetch;
}): Promise<{ external_post_id: string }> {
  if (isStubToken(input.access_token) || input.ig_user_id.startsWith("stub-")) {
    return { external_post_id: `ig_stub_${Date.now()}` };
  }
  const fetchImpl = input.fetchImpl ?? globalThis.fetch.bind(globalThis);

  const createUrl = new URL(
    `https://graph.facebook.com/v21.0/${encodeURIComponent(input.ig_user_id)}/media`,
  );
  const createBody = new URLSearchParams({
    image_url: input.image_url,
    caption: input.caption.slice(0, 2200),
    access_token: input.access_token,
  });
  const createRes = await fetchImpl(createUrl.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: createBody,
  });
  const createJson = (await createRes.json().catch(() => ({}))) as {
    id?: string;
    error?: { message?: string; code?: number };
  };
  if (!createRes.ok || !createJson.id) {
    const msg = createJson.error?.message ?? `HTTP ${createRes.status}`;
    throw new KernelError("PROVIDER_ERROR", `Instagram media container failed: ${msg}`, {
      details: {
        status: createRes.status,
        facebook_error: createJson.error?.message ?? null,
        facebook_code: createJson.error?.code ?? null,
      },
      retryable: createRes.status === 429,
    });
  }

  const creationId = createJson.id;
  // Meta requires FINISHED before media_publish (error 9007 otherwise).
  for (let i = 0; i < 12; i++) {
    const statusUrl = new URL(`https://graph.facebook.com/v21.0/${encodeURIComponent(creationId)}`);
    statusUrl.searchParams.set("fields", "status_code");
    statusUrl.searchParams.set("access_token", input.access_token);
    const statusRes = await fetchImpl(statusUrl.toString());
    const statusJson = (await statusRes.json().catch(() => ({}))) as {
      status_code?: string;
      error?: { message?: string };
    };
    const code = statusJson.status_code ?? "UNKNOWN";
    if (code === "FINISHED") break;
    if (code === "ERROR" || code === "EXPIRED") {
      throw new KernelError(
        "PROVIDER_ERROR",
        `Instagram media container ${code}: ${statusJson.error?.message ?? "processing failed"}`,
        { details: { creation_id: creationId, status_code: code } },
      );
    }
    await new Promise((r) => setTimeout(r, 1500));
  }

  const publishUrl = new URL(
    `https://graph.facebook.com/v21.0/${encodeURIComponent(input.ig_user_id)}/media_publish`,
  );
  const publishBody = new URLSearchParams({
    creation_id: creationId,
    access_token: input.access_token,
  });
  const publishRes = await fetchImpl(publishUrl.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: publishBody,
  });
  const publishJson = (await publishRes.json().catch(() => ({}))) as {
    id?: string;
    error?: { message?: string; code?: number };
  };
  if (!publishRes.ok || !publishJson.id) {
    const msg = publishJson.error?.message ?? `HTTP ${publishRes.status}`;
    throw new KernelError("PROVIDER_ERROR", `Instagram media_publish failed: ${msg}`, {
      details: {
        status: publishRes.status,
        facebook_error: publishJson.error?.message ?? null,
        facebook_code: publishJson.error?.code ?? null,
        creation_id: creationId,
      },
      retryable: publishRes.status === 429,
    });
  }
  return { external_post_id: publishJson.id };
}

export const packageName = "@at72-verse/tool-social-publish" as const;
