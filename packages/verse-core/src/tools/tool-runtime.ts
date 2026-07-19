/**
 * Tool Runtime (Phase 19 / DM1 · Phase 20 Permission Engine).
 * Allowlist + grants · Ajv · timeout · audit · ToolHostPort execute.
 * Kernel.tools.execute signature unchanged.
 */
import { randomUUID } from "node:crypto";
import type {
  KernelContext,
  ToolExecuteRequest,
  ToolExecuteResult,
  ToolSpec,
} from "@at72-verse/contracts";
import { validateDataAgainstJsonSchema } from "@at72-verse/contracts";
import { KernelError } from "@at72-verse/verse-kernel";
import type { PersonaEngine } from "../persona/persona-engine.js";
import { PermissionEngine } from "../permissions/permission-engine.js";
import {
  assertCapabilityInstalled,
  isCapabilityInstalled,
} from "../registry/package-install-gate.js";
import type { ToolExecutionAuditPort, ToolExecutionAuditStatus } from "./tool-audit-port.js";
import type { ToolHostPort } from "./tool-host-port.js";
import type { OAuthConnector } from "../connectors/oauth-connector.js";
import type { ConnectorProviderId } from "@at72-verse/contracts";
import { toolRequiresApproval } from "../permissions/permission-engine.js";
import type { ApprovalStorePort } from "../approvals/approval-store-port.js";
import { buildApprovalInputPreview } from "../approvals/approval-store-port.js";

/** Map oauth tools to connector provider (Phase 28b). */
function oauthProviderForTool(toolId: string): ConnectorProviderId | null {
  if (toolId === "social-publish") return "linkedin";
  return null;
}

function summarize(value: unknown, max = 500): string {
  try {
    const s = JSON.stringify(value);
    return s.length <= max ? s : `${s.slice(0, max)}…`;
  } catch {
    return String(value).slice(0, max);
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, toolId: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => {
          reject(
            new KernelError("TIMEOUT", `Tool execution timed out after ${timeoutMs}ms`, {
              details: { tool_id: toolId, timeout_ms: timeoutMs },
            }),
          );
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export class ToolRuntime {
  private host: ToolHostPort | undefined;
  private personaEngine: PersonaEngine;
  private permissionEngine: PermissionEngine;
  private audit: ToolExecutionAuditPort;
  private oauthConnector: OAuthConnector | undefined;
  private approvalStore: ApprovalStorePort | undefined;

  constructor(options: {
    host?: ToolHostPort;
    personaEngine: PersonaEngine;
    permissionEngine?: PermissionEngine;
    audit?: ToolExecutionAuditPort;
    oauthConnector?: OAuthConnector;
    approvalStore?: ApprovalStorePort;
  }) {
    this.host = options.host;
    this.personaEngine = options.personaEngine;
    this.permissionEngine = options.permissionEngine ?? new PermissionEngine();
    this.audit = options.audit ?? {
      async record() {
        /* no-op until host wires audit */
      },
    };
    this.oauthConnector = options.oauthConnector;
    this.approvalStore = options.approvalStore;
  }

  setHost(host: ToolHostPort | undefined): void {
    this.host = host;
  }

  setPersonaEngine(engine: PersonaEngine): void {
    this.personaEngine = engine;
  }

  setPermissionEngine(engine: PermissionEngine): void {
    this.permissionEngine = engine;
  }

  setAudit(audit: ToolExecutionAuditPort): void {
    this.audit = audit;
  }

  setOAuthConnector(connector: OAuthConnector | undefined): void {
    this.oauthConnector = connector;
  }

  setApprovalStore(store: ApprovalStorePort | undefined): void {
    this.approvalStore = store;
  }

  async listAvailable(context: KernelContext): Promise<string[]> {
    if (!this.host) return [];
    const resolved = await this.personaEngine.resolve(
      context.agent_id,
      context.organization_id,
      context.workspace_id,
    );
    const registered = await this.host.listRegistered();
    const out: string[] = [];
    for (const toolId of registered) {
      let sideEffect = false;
      try {
        const spec = await this.host.resolve(toolId);
        sideEffect = spec.spec.side_effect;
      } catch {
        continue;
      }
      const decision = this.permissionEngine.evaluateToolExecute({
        tool_id: toolId,
        side_effect: sideEffect,
        persona_tools: resolved.spec.tools,
        agent_allowlist: context.tools_allowlist ?? [],
        grants_snapshot: context.grants_snapshot,
      });
      if (
        decision.allowed &&
        isCapabilityInstalled(context.packages_snapshot, "tool", toolId)
      ) {
        out.push(toolId);
      }
    }
    return out.sort();
  }

  async execute(request: ToolExecuteRequest, context: KernelContext): Promise<ToolExecuteResult> {
    const executionId = randomUUID();
    const started = Date.now();
    let toolVersion: string | null = null;
    let status: ToolExecutionAuditStatus = "failed";
    let errorMsg: string | null = null;
    let outputSummary: string | null = null;

    const finish = async (extra?: { output?: Record<string, unknown> }) => {
      await this.audit.record({
        execution_id: executionId,
        organization_id: context.organization_id,
        workspace_id: context.workspace_id,
        run_id: context.run_id,
        step_id: context.step_id ?? null,
        trace_id: context.trace_id ?? null,
        agent_id: context.agent_id,
        tool_id: request.tool_id,
        tool_version: toolVersion,
        status,
        duration_ms: Date.now() - started,
        error: errorMsg,
        input_summary: summarize(request.input),
        output_summary: outputSummary ?? (extra?.output ? summarize(extra.output) : null),
        created_at: new Date().toISOString(),
      });
    };

    if (!this.host) {
      status = "failed";
      errorMsg = "ToolHost not configured";
      await finish();
      throw new KernelError(
        "UNAVAILABLE",
        "Kernel.tools.execute requires a host Tool registry (Phase 19 / DM3)",
        { details: { tool_id: request.tool_id } },
      );
    }

    const resolvedPersona = await this.personaEngine.resolve(
      context.agent_id,
      context.organization_id,
      context.workspace_id,
    );

    let spec: ToolSpec;
    try {
      const resolved = await this.host.resolve(request.tool_id);
      toolVersion = resolved.version;
      spec = resolved.spec;
    } catch (err) {
      status = "failed";
      errorMsg = err instanceof Error ? err.message : String(err);
      await finish();
      throw err;
    }

    try {
      assertCapabilityInstalled({
        packages_snapshot: context.packages_snapshot,
        kind: "tool",
        capability_id: request.tool_id,
      });
    } catch (err) {
      status = "forbidden";
      errorMsg = err instanceof Error ? err.message : String(err);
      await finish();
      throw err;
    }

    const decision = this.permissionEngine.evaluateToolExecute({
      tool_id: request.tool_id,
      side_effect: spec.side_effect,
      persona_tools: resolvedPersona.spec.tools,
      agent_allowlist: context.tools_allowlist ?? [],
      grants_snapshot: context.grants_snapshot,
    });
    if (!decision.allowed) {
      status = "forbidden";
      errorMsg = `Tool not allowed: ${request.tool_id} (${decision.reasons.join(",")})`;
      await finish();
      throw new KernelError("FORBIDDEN", errorMsg, {
        details: {
          tool_id: request.tool_id,
          reasons: decision.reasons,
          ...(decision.details ?? {}),
        },
      });
    }

    const inputCheck = validateDataAgainstJsonSchema(
      spec.input_schema as Record<string, unknown>,
      request.input,
    );
    if (!inputCheck.ok) {
      status = "invalid_input";
      errorMsg = "Tool input schema validation failed";
      await finish();
      throw new KernelError("INVALID_INPUT", errorMsg, {
        details: { tool_id: request.tool_id, errors: inputCheck.errors },
      });
    }

    let output: Record<string, unknown>;
    try {
      const wantsLive = request.input.mode === "live";
      const resumeApprovalId = context.resume_approval_id ?? null;

      // Phase 29 — single-flight claim before any OAuth / LinkedIn side-effect.
      if (resumeApprovalId) {
        if (!this.approvalStore) {
          status = "failed";
          errorMsg = "Approval store not configured for HITL resume";
          await finish();
          throw new KernelError("UNAVAILABLE", errorMsg, {
            details: { approval_id: resumeApprovalId, tool_id: request.tool_id },
          });
        }
        const claimed = await this.approvalStore.tryClaimExecution(resumeApprovalId);
        if (!claimed) {
          status = "failed";
          errorMsg = "APPROVAL_ALREADY_CONSUMED";
          await finish();
          throw new KernelError(
            "APPROVAL_ALREADY_CONSUMED",
            "Approval already consumed or not executable",
            {
              details: {
                approval_id: resumeApprovalId,
                tool_id: request.tool_id,
                code: "APPROVAL_ALREADY_CONSUMED",
              },
            },
          );
        }
      } else if (
        wantsLive &&
        spec.side_effect &&
        toolRequiresApproval(context.grants_snapshot, request.tool_id)
      ) {
        if (!this.approvalStore) {
          status = "failed";
          errorMsg = "Approval store not configured for HITL";
          await finish();
          throw new KernelError("UNAVAILABLE", errorMsg, {
            details: { tool_id: request.tool_id },
          });
        }
        const pending = await this.approvalStore.createPending({
          organization_id: context.organization_id,
          workspace_id: context.workspace_id,
          run_id: context.run_id,
          step_id: context.step_id ?? null,
          tool_id: request.tool_id,
          agent_id: context.agent_id,
          input_snapshot: { ...request.input },
          input_preview: buildApprovalInputPreview(request.input),
        });
        status = "failed";
        errorMsg = "WAITING_APPROVAL";
        await finish();
        throw new KernelError("WAITING_APPROVAL", "Tool execution waiting for human approval", {
          details: {
            approval_id: pending.id,
            tool_id: request.tool_id,
            code: "WAITING_APPROVAL",
          },
        });
      }

      let oauth: { provider: string; access_token: string } | undefined;

      if (wantsLive) {
        if (spec.auth?.type !== "oauth") {
          status = "invalid_input";
          errorMsg = "mode live requires an oauth tool";
          await finish();
          throw new KernelError("INVALID_INPUT", errorMsg, {
            details: { tool_id: request.tool_id },
          });
        }
        const provider = oauthProviderForTool(request.tool_id);
        if (!provider || !this.oauthConnector) {
          status = "failed";
          errorMsg = "CONNECTOR_NOT_CONNECTED";
          await finish();
          throw new KernelError(
            "CONNECTOR_NOT_CONNECTED",
            "No valid OAuth connector for live tool execution",
            {
              details: {
                tool_id: request.tool_id,
                provider: provider ?? null,
                code: "CONNECTOR_NOT_CONNECTED",
              },
            },
          );
        }
        const accessToken = await this.oauthConnector.resolveAccessToken({
          workspace_id: context.workspace_id,
          provider,
        });
        if (!accessToken) {
          status = "failed";
          errorMsg = "CONNECTOR_NOT_CONNECTED";
          await finish();
          throw new KernelError(
            "CONNECTOR_NOT_CONNECTED",
            "OAuth connector missing, invalid, or revoked",
            {
              details: {
                tool_id: request.tool_id,
                provider,
                workspace_id: context.workspace_id,
                code: "CONNECTOR_NOT_CONNECTED",
              },
            },
          );
        }
        oauth = { provider, access_token: accessToken };
      }

      output = await withTimeout(
        this.host.execute(request.tool_id, {
          input: request.input,
          organization_id: context.organization_id,
          workspace_id: context.workspace_id,
          run_id: context.run_id,
          agent_id: context.agent_id,
          ...(oauth ? { oauth } : {}),
        }),
        spec.timeout_ms,
        request.tool_id,
      );
    } catch (err) {
      if (err instanceof KernelError && err.code === "WAITING_APPROVAL") {
        throw err;
      }
      if (err instanceof KernelError && err.code === "TIMEOUT") {
        status = "timeout";
        errorMsg = err.message;
        await finish();
        throw err;
      }
      status = "failed";
      errorMsg = err instanceof Error ? err.message : String(err);
      await finish();
      throw err instanceof KernelError
        ? err
        : new KernelError("INTERNAL", errorMsg, {
            details: { tool_id: request.tool_id },
            cause: err,
          });
    }

    const outputCheck = validateDataAgainstJsonSchema(
      spec.output_schema as Record<string, unknown>,
      output,
    );
    if (!outputCheck.ok) {
      status = "invalid_output";
      errorMsg = "Tool output schema validation failed";
      outputSummary = summarize(output);
      await finish();
      throw new KernelError("INVALID_INPUT", errorMsg, {
        details: { tool_id: request.tool_id, errors: outputCheck.errors },
      });
    }

    status = "completed";
    outputSummary = summarize(output);
    await finish({ output });
    return { output, execution_id: executionId };
  }
}
