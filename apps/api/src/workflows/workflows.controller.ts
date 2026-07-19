import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard.js";
import type { RequestWithAuth } from "../auth/auth.tokens.js";
import { RequireWorkspaceMember } from "../rbac/rbac.decorators.js";
import { RbacGuard } from "../rbac/rbac.guard.js";
import { WorkflowsService } from "./workflows.service.js";

@Controller()
@UseGuards(AuthGuard, RbacGuard)
export class WorkflowsController {
  constructor(private readonly workflows: WorkflowsService) {}

  @Get("workflows")
  list() {
    return this.workflows.listDefinitions();
  }

  @Post("workspaces/:workspaceId/workflows/:workflowId/run")
  @RequireWorkspaceMember("EDITOR")
  start(
    @Req() req: RequestWithAuth,
    @Param("workspaceId") workspaceId: string,
    @Param("workflowId") workflowId: string,
    @Body() body: { brief?: string },
  ) {
    return this.workflows.start({
      userId: req.verseAuth!.user.id,
      workspaceId,
      workflowId,
      brief: body.brief ?? "",
    });
  }

  @Get("workflow-runs/:workflowRunId")
  get(@Req() req: RequestWithAuth, @Param("workflowRunId") workflowRunId: string) {
    return this.workflows.getWorkflowRun(workflowRunId, req.verseAuth!.user.id);
  }

  @Post("workflow-runs/:workflowRunId/resume")
  resume(@Req() req: RequestWithAuth, @Param("workflowRunId") workflowRunId: string) {
    return this.workflows.resume(workflowRunId, req.verseAuth!.user.id);
  }
}
