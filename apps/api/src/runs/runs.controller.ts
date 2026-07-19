import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import type { RunStatus } from "@at72-verse/contracts";
import { AuthGuard } from "../auth/auth.guard.js";
import type { RequestWithAuth } from "../auth/auth.tokens.js";
import { RequireWorkspaceMember } from "../rbac/rbac.decorators.js";
import { RbacGuard } from "../rbac/rbac.guard.js";
import { RunsService } from "./runs.service.js";

type CreateConversationBody = { title?: string };
type CreateMessageBody = {
  content?: string;
  role?: "user" | "assistant" | "system";
};
type CreateRunBody = {
  conversation_id?: string | null;
  metadata?: Record<string, unknown> | null;
  target_agent?: string | null;
  goal?: string;
  budget?: { max_usd?: number; max_tokens?: number } | null;
  initial_step?: {
    name?: string;
    kind?: string;
    agent_id?: string | null;
    input?: Record<string, unknown> | null;
  };
};
type CreateStepBody = {
  name?: string;
  kind?: string;
  agent_id?: string | null;
  parent_step_id?: string | null;
  input?: Record<string, unknown> | null;
};
type PatchStatusBody = {
  status?: RunStatus;
  error?: Record<string, unknown> | null;
};

@Controller()
@UseGuards(AuthGuard, RbacGuard)
export class RunsController {
  constructor(private readonly runs: RunsService) {}

  @Post("workspaces/:workspaceId/conversations")
  @RequireWorkspaceMember("EDITOR")
  createConversation(
    @Req() req: RequestWithAuth,
    @Param("workspaceId") workspaceId: string,
    @Body() body: CreateConversationBody,
  ) {
    return this.runs.createConversation({
      workspaceId,
      userId: req.verseAuth!.user.id,
      title: body.title,
    });
  }

  @Get("conversations/:conversationId")
  getConversation(@Req() req: RequestWithAuth, @Param("conversationId") conversationId: string) {
    return this.runs.getConversation(conversationId, req.verseAuth!.user.id);
  }

  @Get("workspaces/:workspaceId/conversations")
  @RequireWorkspaceMember("VIEWER")
  listConversations(
    @Req() req: RequestWithAuth,
    @Param("workspaceId") workspaceId: string,
  ) {
    return this.runs.listConversations(workspaceId, req.verseAuth!.user.id);
  }

  @Get("conversations/:conversationId/messages")
  listMessages(
    @Req() req: RequestWithAuth,
    @Param("conversationId") conversationId: string,
  ) {
    return this.runs.listMessages(conversationId, req.verseAuth!.user.id);
  }

  @Post("conversations/:conversationId/messages")
  createMessage(
    @Req() req: RequestWithAuth,
    @Param("conversationId") conversationId: string,
    @Body() body: CreateMessageBody,
  ) {
    return this.runs.createMessage({
      conversationId,
      userId: req.verseAuth!.user.id,
      content: body.content ?? "",
      role: body.role,
    });
  }

  @Post("workspaces/:workspaceId/runs")
  @RequireWorkspaceMember("EDITOR")
  createRun(
    @Req() req: RequestWithAuth,
    @Param("workspaceId") workspaceId: string,
    @Body() body: CreateRunBody,
  ) {
    return this.runs.createRun({
      workspaceId,
      userId: req.verseAuth!.user.id,
      conversationId: body.conversation_id,
      metadata: body.metadata,
      targetAgent: body.target_agent,
      goal: body.goal,
      budget: body.budget,
      initialStep: body.initial_step
        ? {
            name: body.initial_step.name,
            kind: body.initial_step.kind,
            agentId: body.initial_step.agent_id,
            input: body.initial_step.input,
          }
        : undefined,
    });
  }

  @Get("runs/:runId/cost")
  getRunCost(@Req() req: RequestWithAuth, @Param("runId") runId: string) {
    return this.runs.getRunCost(runId, req.verseAuth!.user.id);
  }

  @Get("runs/:runId")
  getRun(@Req() req: RequestWithAuth, @Param("runId") runId: string) {
    return this.runs.getRun(runId, req.verseAuth!.user.id);
  }

  @Get("runs/:runId/steps")
  listSteps(@Req() req: RequestWithAuth, @Param("runId") runId: string) {
    return this.runs.listSteps(runId, req.verseAuth!.user.id);
  }

  @Post("runs/:runId/steps")
  createStep(
    @Req() req: RequestWithAuth,
    @Param("runId") runId: string,
    @Body() body: CreateStepBody,
  ) {
    return this.runs.createStep({
      runId,
      userId: req.verseAuth!.user.id,
      name: body.name ?? "",
      kind: body.kind,
      agentId: body.agent_id,
      parentStepId: body.parent_step_id,
      input: body.input,
    });
  }

  /**
   * Technical demo/test endpoint (Phase 11 / AF2) — not a product UX surface.
   * Enforces documented status transitions only.
   */
  @Patch("runs/:runId/status")
  patchStatus(
    @Req() req: RequestWithAuth,
    @Param("runId") runId: string,
    @Body() body: PatchStatusBody,
  ) {
    if (!body.status) {
      throw new BadRequestException({
        code: "invalid_input",
        message: "status is required",
      });
    }
    return this.runs.patchStatus({
      runId,
      userId: req.verseAuth!.user.id,
      status: body.status,
      error: body.error,
    });
  }
}
