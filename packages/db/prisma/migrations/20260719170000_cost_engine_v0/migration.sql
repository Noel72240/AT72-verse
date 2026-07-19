-- Phase 21: Cost Engine — enrich llm_usages + workspace budget defaults (DO3a · DO5)

ALTER TABLE "workspaces" ADD COLUMN "default_run_budget_max_usd" DECIMAL(12,6);
ALTER TABLE "workspaces" ADD COLUMN "default_run_budget_max_tokens" INTEGER;

ALTER TABLE "llm_usages" ADD COLUMN "estimated_usd" DECIMAL(14,8) NOT NULL DEFAULT 0;
ALTER TABLE "llm_usages" ADD COLUMN "pricing_version" TEXT NOT NULL DEFAULT 'unknown';
