/** Browser API client — Nest HTTP only (Phase 16 / CC1). */

export type ApiConversation = {
  id: string;
  organization_id: string;
  workspace_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
};

export type ApiMessage = {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  created_at: string;
};

export type ApiRun = {
  id: string;
  workspace_id: string;
  conversation_id: string | null;
  status: "queued" | "running" | "waiting_approval" | "completed" | "failed";
  error: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
};

export type ApiRunStep = {
  id: string;
  run_id: string;
  parent_step_id: string | null;
  seq: number;
  name: string;
  kind: string;
  agent_id: string | null;
  status: string;
  output: Record<string, unknown> | null;
};

export type OrgMembership = {
  role: string;
  organization: {
    id: string;
    name: string;
    slug: string;
    deletedAt?: string | null;
    deleted_at?: string | null;
  };
};

export type Workspace = {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
};

const TOKEN_KEY = "verse_access_token";
const WORKSPACE_KEY = "verse_workspace_id";
const ORG_KEY = "verse_org_id";

export function getApiBase(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getStoredWorkspaceId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(WORKSPACE_KEY);
}

export function setStoredWorkspaceId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(WORKSPACE_KEY, id);
  else localStorage.removeItem(WORKSPACE_KEY);
}

export function getStoredOrgId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ORG_KEY);
}

export function setStoredOrgId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) localStorage.setItem(ORG_KEY, id);
  else localStorage.removeItem(ORG_KEY);
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const token = options.token === undefined ? getToken() : options.token;
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const res = await fetch(`${getApiBase()}${path}`, {
    ...options,
    headers,
  });
  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = await res.text();
    }
    throw new ApiError(`API ${res.status} ${path}`, res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export async function loginDev(email: string): Promise<string> {
  const data = await apiFetch<{ accessToken: string }>("/auth/dev/login", {
    method: "POST",
    token: null,
    body: JSON.stringify({
      email,
      displayName: email.split("@")[0],
      idpUserId: `dev_${email.replace(/[^a-z0-9]/gi, "_")}`,
    }),
  });
  setToken(data.accessToken);
  await apiFetch("/me");
  return data.accessToken;
}

export async function listOrganizations(): Promise<OrgMembership[]> {
  return apiFetch("/organizations");
}

export async function listWorkspaces(orgId: string): Promise<Workspace[]> {
  return apiFetch(`/organizations/${orgId}/workspaces`);
}

export async function createOrganization(name: string, slug: string) {
  return apiFetch<{
    organization: { id: string; name: string };
    workspace: Workspace;
  }>("/organizations", {
    method: "POST",
    body: JSON.stringify({ name, slug }),
  });
}

export async function listConversations(workspaceId: string): Promise<ApiConversation[]> {
  return apiFetch(`/workspaces/${workspaceId}/conversations`);
}

export async function createConversation(
  workspaceId: string,
  title?: string,
): Promise<ApiConversation> {
  return apiFetch(`/workspaces/${workspaceId}/conversations`, {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export async function listMessages(conversationId: string): Promise<ApiMessage[]> {
  return apiFetch(`/conversations/${conversationId}/messages`);
}

export async function createMessage(
  conversationId: string,
  content: string,
): Promise<ApiMessage> {
  return apiFetch(`/conversations/${conversationId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content, role: "user" }),
  });
}

export async function createRun(input: {
  workspaceId: string;
  conversationId: string;
  goal: string;
}): Promise<{ run: ApiRun; steps: ApiRunStep[] }> {
  return apiFetch(`/workspaces/${input.workspaceId}/runs`, {
    method: "POST",
    body: JSON.stringify({
      conversation_id: input.conversationId,
      target_agent: "adam",
      goal: input.goal,
    }),
  });
}

export async function getRun(runId: string): Promise<ApiRun> {
  return apiFetch(`/runs/${runId}`);
}

export type ApiRunCost = {
  run_id: string;
  pricing_version: string | null;
  max_usd: number | null;
  max_tokens: number | null;
  spent_usd: number;
  spent_tokens: number;
  remaining_usd: number | null;
  remaining_tokens: number | null;
  call_count: number;
};

export async function getRunCost(runId: string): Promise<ApiRunCost> {
  return apiFetch(`/runs/${runId}/cost`);
}

export async function listSteps(runId: string): Promise<ApiRunStep[]> {
  return apiFetch(`/runs/${runId}/steps`);
}

/** Parse SSE bytes from fetch streaming body. */
export async function* readSseStream(
  res: Response,
): AsyncGenerator<{ event: string; data: Record<string, unknown>; id?: string }> {
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  let buffer = "";
  let event = "message";
  let id: string | undefined;
  let dataLines: string[] = [];

  const flush = (): { event: string; data: Record<string, unknown>; id?: string } | null => {
    if (dataLines.length === 0) return null;
    const raw = dataLines.join("\n");
    dataLines = [];
    const ev = event;
    const eid = id;
    event = "message";
    id = undefined;
    try {
      return { event: ev, data: JSON.parse(raw) as Record<string, unknown>, id: eid };
    } catch {
      return { event: ev, data: { raw }, id: eid };
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n");
    buffer = parts.pop() ?? "";
    for (const line of parts) {
      if (line === "") {
        const item = flush();
        if (item) yield item;
        continue;
      }
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      else if (line.startsWith("id:")) id = line.slice(3).trim();
    }
  }
  const last = flush();
  if (last) yield last;
}

/**
 * Open reconnectable SSE for a run (Authorization via fetch — not EventSource).
 * On abort/error, caller re-fetches REST then calls again.
 */
export async function openRunStream(
  runId: string,
  signal: AbortSignal,
): Promise<Response> {
  const token = getToken();
  const res = await fetch(`${getApiBase()}/runs/${runId}/stream`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal,
  });
  if (!res.ok) {
    throw new ApiError(`SSE ${res.status}`, res.status);
  }
  return res;
}

export type ResolvedPersonaPreview = {
  agent_id: string;
  persona_id: string;
  version: string;
  spec: {
    tone?: { formality?: string; voice?: string; language?: string };
    rules?: Array<{ id: string; severity: string; text: string }>;
    [key: string]: unknown;
  };
  provenance: { layers: Array<{ layer: string; contributed_fields: string[] }> };
};

export async function previewWorkspacePersona(
  workspaceId: string,
  agentId: string,
): Promise<ResolvedPersonaPreview> {
  return apiFetch(`/workspaces/${workspaceId}/personas/${agentId}`);
}

export async function saveWorkspacePersona(
  workspaceId: string,
  agentId: string,
  patch: {
    tone?: { formality?: string };
    rules?: Array<{ id: string; severity: "must" | "should" | "must_not"; text: string }>;
  },
): Promise<{
  organization_id: string;
  workspace_id: string | null;
  agent_id: string;
  patch: Record<string, unknown>;
}> {
  return apiFetch(`/workspaces/${workspaceId}/personas/${agentId}`, {
    method: "PUT",
    body: JSON.stringify({ patch }),
  });
}

export type ApiMemoryRecord = {
  id: string;
  scope: string;
  content: string;
  layer: string;
  type: string;
  organization_id: string;
  workspace_id: string;
  run_id: string | null;
  conversation_id: string | null;
  user_id: string | null;
  agent_id: string | null;
  trace_id: string | null;
  created_at: string;
  pinned?: boolean;
  deleted_at?: string | null;
};

export async function listWorkspaceMemory(
  workspaceId: string,
  opts?: { scope?: string; runId?: string; limit?: number },
): Promise<{ records: ApiMemoryRecord[] }> {
  const q = new URLSearchParams();
  if (opts?.scope) q.set("scope", opts.scope);
  if (opts?.runId) q.set("run_id", opts.runId);
  if (opts?.limit) q.set("limit", String(opts.limit));
  const qs = q.toString();
  return apiFetch(`/workspaces/${workspaceId}/memory${qs ? `?${qs}` : ""}`);
}

export async function createWorkspaceMemory(
  workspaceId: string,
  body: { scope?: string; content: string; pinned?: boolean },
): Promise<{ record: ApiMemoryRecord }> {
  return apiFetch(`/workspaces/${workspaceId}/memory`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function pinWorkspaceMemory(
  workspaceId: string,
  memoryId: string,
): Promise<{ record: ApiMemoryRecord }> {
  return apiFetch(`/workspaces/${workspaceId}/memory/${memoryId}/pin`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function forgetWorkspaceMemory(
  workspaceId: string,
  memoryId: string,
): Promise<{ ok: true }> {
  return apiFetch(`/workspaces/${workspaceId}/memory/${memoryId}`, {
    method: "DELETE",
  });
}

export async function listConversationMemory(
  conversationId: string,
  opts?: { scope?: string; limit?: number },
): Promise<{ records: ApiMemoryRecord[] }> {
  const q = new URLSearchParams();
  if (opts?.scope) q.set("scope", opts.scope);
  if (opts?.limit) q.set("limit", String(opts.limit));
  const qs = q.toString();
  return apiFetch(`/conversations/${conversationId}/memory${qs ? `?${qs}` : ""}`);
}

export type ApiPermissionGrant = {
  id: string;
  organization_id: string;
  workspace_id: string;
  kind: "agent" | "skill" | "tool";
  capability_id: string;
  enabled: boolean;
  require_approval: boolean;
  created_at: string;
  updated_at: string;
};

export async function listWorkspaceGrants(
  workspaceId: string,
): Promise<{ grants: ApiPermissionGrant[] }> {
  return apiFetch(`/workspaces/${workspaceId}/grants`);
}

export async function setWorkspaceGrant(
  workspaceId: string,
  input: {
    kind: "agent" | "skill" | "tool";
    capability_id: string;
    enabled: boolean;
    require_approval?: boolean;
  },
): Promise<{ grant: ApiPermissionGrant }> {
  return apiFetch(`/workspaces/${workspaceId}/grants`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export type ApiApprovalRequest = {
  id: string;
  organization_id: string;
  workspace_id: string;
  run_id: string;
  step_id: string | null;
  tool_id: string;
  agent_id: string;
  status: string;
  input_preview: {
    platform?: string;
    mode?: string;
    content_preview?: string;
  };
  expires_at: string;
  decided_at: string | null;
  executed_at: string | null;
  created_at: string;
  updated_at: string;
};

export async function listWorkspaceApprovals(
  workspaceId: string,
  status?: string,
): Promise<{ approvals: ApiApprovalRequest[] }> {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  return apiFetch(`/workspaces/${workspaceId}/approvals${q}`);
}

export async function approveRunApproval(
  runId: string,
  approvalId: string,
): Promise<{ approval: ApiApprovalRequest }> {
  return apiFetch(`/runs/${runId}/approve`, {
    method: "POST",
    body: JSON.stringify({ approval_id: approvalId }),
  });
}

export async function rejectRunApproval(
  runId: string,
  approvalId: string,
): Promise<{ approval: ApiApprovalRequest }> {
  return apiFetch(`/runs/${runId}/reject`, {
    method: "POST",
    body: JSON.stringify({ approval_id: approvalId }),
  });
}

export type ApiCatalogPackage = {
  package_id: string;
  kind: "agent" | "skill" | "tool" | "workflow" | "prompt_pack";
  capability_id: string;
  publisher: string;
  display_name: string;
  description: string;
  latest_version: string;
  versions: string[];
};

export type ApiTenantPackage = {
  id: string;
  organization_id: string;
  package_id: string;
  pinned_version: string;
  status: "installed" | "uninstalled";
  installed_at: string;
  uninstalled_at: string | null;
  updated_at: string;
};

export async function listCatalogPackages(): Promise<{ packages: ApiCatalogPackage[] }> {
  return apiFetch("/packages");
}

export async function listOrganizationPackages(
  organizationId: string,
): Promise<{ installs: ApiTenantPackage[] }> {
  return apiFetch(`/organizations/${organizationId}/packages`);
}

export async function installOrganizationPackage(
  organizationId: string,
  input: { package_id: string; pinned_version?: string; workspace_id?: string },
): Promise<{ install: ApiTenantPackage }> {
  return apiFetch(`/organizations/${organizationId}/packages/install`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function uninstallOrganizationPackage(
  organizationId: string,
  packageId: string,
): Promise<{ install: ApiTenantPackage }> {
  return apiFetch(`/organizations/${organizationId}/packages/${encodeURIComponent(packageId)}/uninstall`, {
    method: "POST",
  });
}

export async function pinOrganizationPackage(
  organizationId: string,
  packageId: string,
  pinned_version: string,
): Promise<{ install: ApiTenantPackage }> {
  return apiFetch(`/organizations/${organizationId}/packages/${encodeURIComponent(packageId)}/pin`, {
    method: "PUT",
    body: JSON.stringify({ pinned_version }),
  });
}

export type ApiOrgQuotaLimits = {
  plan_id: "free" | "pro" | "enterprise";
  runs_per_month: number;
  tokens_per_month: number;
  max_agents_installed: number;
  api_rpm: number;
};

export type ApiOrgQuotaUsage = {
  runs_this_month: number;
  tokens_this_month: number;
  agents_installed: number;
};

export type ApiOrgQuotaStatus = {
  limits: ApiOrgQuotaLimits;
  usage: ApiOrgQuotaUsage;
  reset_at: string;
};

export type ApiQuotaAuditEntry = {
  id: string;
  organization_id: string;
  actor_user_id: string;
  previous_value: ApiOrgQuotaLimits;
  new_value: ApiOrgQuotaLimits;
  reason: string | null;
  created_at: string;
};

export async function getOrganizationQuotas(
  organizationId: string,
): Promise<ApiOrgQuotaStatus> {
  return apiFetch(`/organizations/${organizationId}/quotas`);
}

export async function putOrganizationQuotas(
  organizationId: string,
  body: {
    plan_id?: string;
    runs_per_month?: number | null;
    tokens_per_month?: number | null;
    max_agents_installed?: number | null;
    api_rpm?: number | null;
    reason?: string | null;
  },
): Promise<{ limits: ApiOrgQuotaLimits; audit: ApiQuotaAuditEntry }> {
  return apiFetch(`/organizations/${organizationId}/quotas`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function listOrganizationQuotaAudit(
  organizationId: string,
): Promise<{ entries: ApiQuotaAuditEntry[] }> {
  return apiFetch(`/organizations/${organizationId}/quotas/audit`);
}

export type ApiExportJob = {
  id: string;
  organization_id: string | null;
  user_id: string;
  scope: "user" | "organization";
  status: string;
  expires_at: string;
  completed_at: string | null;
  created_at: string;
};

export type ApiAuditEvent = {
  id: string;
  organization_id: string | null;
  actor_user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export async function requestUserExport(): Promise<{
  job: ApiExportJob;
  payload: unknown;
}> {
  return apiFetch("/me/export", { method: "POST", body: "{}" });
}

export async function requestOrganizationExport(
  organizationId: string,
): Promise<{ job: ApiExportJob; payload: unknown }> {
  return apiFetch(`/organizations/${organizationId}/export`, {
    method: "POST",
    body: "{}",
  });
}

export async function softDeleteMe(): Promise<unknown> {
  return apiFetch("/me/soft-delete", { method: "POST", body: "{}" });
}

export async function restoreMe(): Promise<unknown> {
  return apiFetch("/me/restore", { method: "POST", body: "{}" });
}

export async function softDeleteOrganization(organizationId: string): Promise<unknown> {
  return apiFetch(`/organizations/${organizationId}/soft-delete`, {
    method: "POST",
    body: "{}",
  });
}

export async function restoreOrganization(organizationId: string): Promise<unknown> {
  return apiFetch(`/organizations/${organizationId}/restore`, {
    method: "POST",
    body: "{}",
  });
}

export async function getOrganizationAuditEvents(
  organizationId: string,
): Promise<{ events: ApiAuditEvent[] }> {
  return apiFetch(`/organizations/${organizationId}/audit-events`);
}

export async function putOrganizationRetention(
  organizationId: string,
  body: { soft_delete_grace_days?: number; audit_retention_days?: number },
): Promise<{ soft_delete_grace_days: number; audit_retention_days: number }> {
  return apiFetch(`/organizations/${organizationId}/retention`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export type ApiOrgBilling = {
  organization_id: string;
  provider: string;
  status: string;
  plan_id: string;
  provider_customer_id: string | null;
  provider_subscription_id: string | null;
  current_period_end: string | null;
  grace_until: string | null;
  updated_at: string;
};

export type ApiBillingInvoice = {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  created_at: string;
  invoice_url: string | null;
};

export async function getOrganizationBilling(
  organizationId: string,
): Promise<ApiOrgBilling> {
  return apiFetch(`/organizations/${organizationId}/billing`);
}

export async function startOrganizationCheckout(
  organizationId: string,
  body: { target_plan: "pro" | "enterprise"; success_url?: string; cancel_url?: string },
): Promise<{ checkout_id: string; checkout_url: string }> {
  return apiFetch(`/organizations/${organizationId}/billing/checkout`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function openOrganizationBillingPortal(
  organizationId: string,
  body?: { return_url?: string },
): Promise<{ manage_url: string }> {
  return apiFetch(`/organizations/${organizationId}/billing/portal`, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
}

export async function cancelOrganizationBilling(
  organizationId: string,
): Promise<ApiOrgBilling> {
  return apiFetch(`/organizations/${organizationId}/billing/cancel`, {
    method: "POST",
    body: "{}",
  });
}

export async function listOrganizationInvoices(
  organizationId: string,
): Promise<{ invoices: ApiBillingInvoice[] }> {
  return apiFetch(`/organizations/${organizationId}/billing/invoices`);
}

export type ApiWorkflowDefinition = {
  id: string;
  version: string;
  display_name: string;
  description?: string;
  trigger: string;
  steps: Array<Record<string, unknown>>;
};

export type ApiWorkflowRun = {
  id: string;
  workflow_id: string;
  workflow_version: string;
  run_id: string;
  status: string;
  completed_step_ids: string[];
  cursor_step_id: string | null;
  error: Record<string, unknown> | null;
};

export async function listWorkflows(): Promise<{ workflows: ApiWorkflowDefinition[] }> {
  return apiFetch("/workflows");
}

export async function startWorkflow(
  workspaceId: string,
  workflowId: string,
  body: { brief: string },
): Promise<{ workflow_run: ApiWorkflowRun }> {
  return apiFetch(`/workspaces/${workspaceId}/workflows/${encodeURIComponent(workflowId)}/run`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function getWorkflowRun(
  workflowRunId: string,
): Promise<{ workflow_run: ApiWorkflowRun }> {
  return apiFetch(`/workflow-runs/${encodeURIComponent(workflowRunId)}`);
}

export async function resumeWorkflowRun(
  workflowRunId: string,
): Promise<{ workflow_run: ApiWorkflowRun }> {
  return apiFetch(`/workflow-runs/${encodeURIComponent(workflowRunId)}/resume`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export type ApiConnectorConnection = {
  id: string;
  organization_id: string;
  workspace_id: string;
  provider: string;
  status: string;
  external_account_hint: string | null;
  connected_at: string | null;
  revoked_at: string | null;
  updated_at: string;
};

export async function listWorkspaceConnectors(
  workspaceId: string,
): Promise<{ connections: ApiConnectorConnection[] }> {
  return apiFetch(`/workspaces/${workspaceId}/connectors`);
}

export async function startWorkspaceConnector(
  workspaceId: string,
  provider: string,
): Promise<{ authorize_url: string; provider: string }> {
  return apiFetch(`/workspaces/${workspaceId}/connectors/${encodeURIComponent(provider)}/connect`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function disconnectWorkspaceConnector(
  workspaceId: string,
  provider: string,
): Promise<{ ok: true }> {
  return apiFetch(`/workspaces/${workspaceId}/connectors/${encodeURIComponent(provider)}`, {
    method: "DELETE",
  });
}

export type ApiMetaPage = {
  id: string;
  name: string;
  has_instagram: boolean;
};

export async function listMetaPages(
  workspaceId: string,
): Promise<{
  selected_page_id: string | null;
  selected_page_name: string | null;
  pages: ApiMetaPage[];
  pages_diagnostic?: string | null;
}> {
  return apiFetch(`/workspaces/${workspaceId}/connectors/meta/pages`);
}

export async function selectMetaPage(
  workspaceId: string,
  pageId: string,
): Promise<ApiConnectorConnection> {
  return apiFetch(`/workspaces/${workspaceId}/connectors/meta/pages/select`, {
    method: "POST",
    body: JSON.stringify({ page_id: pageId }),
  });
}
