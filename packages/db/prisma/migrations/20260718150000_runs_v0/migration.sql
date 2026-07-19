-- Phase 11 — conversations, messages, runs, run_steps (AA1)

CREATE TYPE "RunStatus" AS ENUM ('queued', 'running', 'completed', 'failed');
CREATE TYPE "RunStepStatus" AS ENUM ('queued', 'running', 'completed', 'failed');
CREATE TYPE "MessageRole" AS ENUM ('user', 'assistant', 'system');

CREATE TABLE "conversations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "created_by_user_id" UUID,
    "title" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "conversation_id" UUID NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "runs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "conversation_id" UUID,
    "created_by_user_id" UUID,
    "status" "RunStatus" NOT NULL DEFAULT 'queued',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "started_at" TIMESTAMPTZ(3),
    "completed_at" TIMESTAMPTZ(3),
    "error" JSONB,
    "metadata" JSONB,

    CONSTRAINT "runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "run_steps" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "run_id" UUID NOT NULL,
    "parent_step_id" UUID,
    "seq" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "agent_id" TEXT,
    "status" "RunStepStatus" NOT NULL DEFAULT 'queued',
    "input" JSONB,
    "output" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "run_steps_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "conversations_organization_id_idx" ON "conversations"("organization_id");
CREATE INDEX "conversations_workspace_id_idx" ON "conversations"("workspace_id");
CREATE INDEX "messages_organization_id_idx" ON "messages"("organization_id");
CREATE INDEX "messages_conversation_id_idx" ON "messages"("conversation_id");
CREATE INDEX "runs_organization_id_idx" ON "runs"("organization_id");
CREATE INDEX "runs_workspace_id_idx" ON "runs"("workspace_id");
CREATE INDEX "runs_conversation_id_idx" ON "runs"("conversation_id");
CREATE INDEX "runs_status_idx" ON "runs"("status");
CREATE UNIQUE INDEX "run_steps_run_id_seq_key" ON "run_steps"("run_id", "seq");
CREATE INDEX "run_steps_organization_id_idx" ON "run_steps"("organization_id");
CREATE INDEX "run_steps_run_id_idx" ON "run_steps"("run_id");
CREATE INDEX "run_steps_parent_step_id_idx" ON "run_steps"("parent_step_id");

ALTER TABLE "conversations" ADD CONSTRAINT "conversations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "messages" ADD CONSTRAINT "messages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "runs" ADD CONSTRAINT "runs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "runs" ADD CONSTRAINT "runs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "runs" ADD CONSTRAINT "runs_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "runs" ADD CONSTRAINT "runs_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "run_steps" ADD CONSTRAINT "run_steps_parent_step_id_fkey" FOREIGN KEY ("parent_step_id") REFERENCES "run_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;
