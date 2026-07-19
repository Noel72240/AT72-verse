-- Phase 29 HITL: require_approval on grants, waiting_approval run statuses, approval_requests

ALTER TABLE "capability_grants" ADD COLUMN IF NOT EXISTS "require_approval" BOOLEAN NOT NULL DEFAULT false;

ALTER TYPE "RunStatus" ADD VALUE IF NOT EXISTS 'waiting_approval';
ALTER TYPE "RunStepStatus" ADD VALUE IF NOT EXISTS 'waiting_approval';

CREATE TABLE IF NOT EXISTS "approval_requests" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "step_id" UUID,
    "tool_id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "input_snapshot" JSONB NOT NULL,
    "input_preview" JSONB NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "decided_by_user_id" UUID,
    "decided_at" TIMESTAMPTZ(3),
    "executed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "approval_requests_organization_id_idx" ON "approval_requests"("organization_id");
CREATE INDEX IF NOT EXISTS "approval_requests_workspace_id_idx" ON "approval_requests"("workspace_id");
CREATE INDEX IF NOT EXISTS "approval_requests_run_id_idx" ON "approval_requests"("run_id");
CREATE INDEX IF NOT EXISTS "approval_requests_status_idx" ON "approval_requests"("status");
CREATE INDEX IF NOT EXISTS "approval_requests_expires_at_idx" ON "approval_requests"("expires_at");

ALTER TABLE "approval_requests" DROP CONSTRAINT IF EXISTS "approval_requests_organization_id_fkey";
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approval_requests" DROP CONSTRAINT IF EXISTS "approval_requests_workspace_id_fkey";
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "approval_requests" DROP CONSTRAINT IF EXISTS "approval_requests_run_id_fkey";
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
