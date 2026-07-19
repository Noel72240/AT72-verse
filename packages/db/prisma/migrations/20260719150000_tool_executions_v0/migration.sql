-- Phase 19 / DM8 — Tool execution audit ledger
CREATE TABLE "tool_executions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "run_id" UUID,
    "step_id" UUID,
    "trace_id" TEXT,
    "agent_id" TEXT NOT NULL,
    "tool_id" TEXT NOT NULL,
    "tool_version" TEXT,
    "status" TEXT NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "error" TEXT,
    "input_summary" TEXT,
    "output_summary" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tool_executions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "tool_executions" ADD CONSTRAINT "tool_executions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tool_executions" ADD CONSTRAINT "tool_executions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tool_executions" ADD CONSTRAINT "tool_executions_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tool_executions" ADD CONSTRAINT "tool_executions_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "run_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "tool_executions_organization_id_idx" ON "tool_executions"("organization_id");
CREATE INDEX "tool_executions_workspace_id_idx" ON "tool_executions"("workspace_id");
CREATE INDEX "tool_executions_run_id_idx" ON "tool_executions"("run_id");
CREATE INDEX "tool_executions_step_id_idx" ON "tool_executions"("step_id");
CREATE INDEX "tool_executions_tool_id_idx" ON "tool_executions"("tool_id");
CREATE INDEX "tool_executions_trace_id_idx" ON "tool_executions"("trace_id");
