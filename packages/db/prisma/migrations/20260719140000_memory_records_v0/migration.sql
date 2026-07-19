-- Phase 18 / DL1 — Memory L1 + L2 persistence
CREATE TABLE "memory_records" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "run_id" UUID,
    "conversation_id" UUID,
    "user_id" UUID,
    "agent_id" TEXT,
    "trace_id" TEXT,
    "scope" TEXT NOT NULL,
    "layer" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memory_records_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "memory_records" ADD CONSTRAINT "memory_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "memory_records" ADD CONSTRAINT "memory_records_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "memory_records" ADD CONSTRAINT "memory_records_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "memory_records" ADD CONSTRAINT "memory_records_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "memory_records" ADD CONSTRAINT "memory_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "memory_records_organization_id_scope_idx" ON "memory_records"("organization_id", "scope");
CREATE INDEX "memory_records_organization_id_run_id_idx" ON "memory_records"("organization_id", "run_id");
CREATE INDEX "memory_records_organization_id_conversation_id_idx" ON "memory_records"("organization_id", "conversation_id");
CREATE INDEX "memory_records_organization_id_user_id_idx" ON "memory_records"("organization_id", "user_id");
CREATE INDEX "memory_records_workspace_id_idx" ON "memory_records"("workspace_id");
