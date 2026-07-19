-- Phase 13 / AW2 — LLM usage ledger (API-owned persistence)

CREATE TABLE "llm_usages" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "run_id" UUID,
    "trace_id" TEXT NOT NULL,
    "llm_call_id" TEXT NOT NULL,
    "agent_id" TEXT,
    "profile" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "credential_source" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_usages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "llm_usages_llm_call_id_key" ON "llm_usages"("llm_call_id");
CREATE INDEX "llm_usages_organization_id_idx" ON "llm_usages"("organization_id");
CREATE INDEX "llm_usages_workspace_id_idx" ON "llm_usages"("workspace_id");
CREATE INDEX "llm_usages_run_id_idx" ON "llm_usages"("run_id");
CREATE INDEX "llm_usages_trace_id_idx" ON "llm_usages"("trace_id");

ALTER TABLE "llm_usages" ADD CONSTRAINT "llm_usages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "llm_usages" ADD CONSTRAINT "llm_usages_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
