-- Phase 26: Workflow definitions + runs
CREATE TABLE IF NOT EXISTS "workflow_definitions" (
  "id" UUID NOT NULL,
  "organization_id" UUID,
  "workflow_id" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "definition" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "workflow_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "workflow_definitions_workflow_id_version_key"
  ON "workflow_definitions"("workflow_id", "version");
CREATE INDEX IF NOT EXISTS "workflow_definitions_organization_id_idx"
  ON "workflow_definitions"("organization_id");

ALTER TABLE "workflow_definitions"
  DROP CONSTRAINT IF EXISTS "workflow_definitions_organization_id_fkey";
ALTER TABLE "workflow_definitions"
  ADD CONSTRAINT "workflow_definitions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "workflow_runs" (
  "id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "workspace_id" UUID NOT NULL,
  "workflow_id" TEXT NOT NULL,
  "workflow_version" TEXT NOT NULL,
  "run_id" UUID NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "definition_snapshot" JSONB NOT NULL,
  "completed_step_ids" JSONB NOT NULL DEFAULT '[]',
  "cursor_step_id" TEXT,
  "input" JSONB NOT NULL DEFAULT '{}',
  "output" JSONB,
  "error" JSONB,
  "engine_state" JSONB,
  "created_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  "started_at" TIMESTAMPTZ(3),
  "completed_at" TIMESTAMPTZ(3),
  CONSTRAINT "workflow_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "workflow_runs_organization_id_idx" ON "workflow_runs"("organization_id");
CREATE INDEX IF NOT EXISTS "workflow_runs_workspace_id_idx" ON "workflow_runs"("workspace_id");
CREATE INDEX IF NOT EXISTS "workflow_runs_run_id_idx" ON "workflow_runs"("run_id");
CREATE INDEX IF NOT EXISTS "workflow_runs_status_idx" ON "workflow_runs"("status");
CREATE INDEX IF NOT EXISTS "workflow_runs_workflow_id_idx" ON "workflow_runs"("workflow_id");

ALTER TABLE "workflow_runs"
  DROP CONSTRAINT IF EXISTS "workflow_runs_organization_id_fkey";
ALTER TABLE "workflow_runs"
  ADD CONSTRAINT "workflow_runs_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workflow_runs"
  DROP CONSTRAINT IF EXISTS "workflow_runs_workspace_id_fkey";
ALTER TABLE "workflow_runs"
  ADD CONSTRAINT "workflow_runs_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workflow_runs"
  DROP CONSTRAINT IF EXISTS "workflow_runs_run_id_fkey";
ALTER TABLE "workflow_runs"
  ADD CONSTRAINT "workflow_runs_run_id_fkey"
  FOREIGN KEY ("run_id") REFERENCES "runs"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
