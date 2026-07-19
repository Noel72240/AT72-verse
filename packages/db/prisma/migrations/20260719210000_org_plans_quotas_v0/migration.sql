-- Phase 31: org plans + quota overrides + lightweight quota audit (EB2/EB3/EB7)

ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "plan_id" TEXT NOT NULL DEFAULT 'free';
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "quota_runs_per_month" INTEGER;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "quota_tokens_per_month" INTEGER;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "quota_max_agents_installed" INTEGER;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "quota_api_rpm" INTEGER;

CREATE TABLE IF NOT EXISTS "quota_audit_entries" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "previous_value" JSONB NOT NULL,
    "new_value" JSONB NOT NULL,
    "reason" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quota_audit_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "quota_audit_entries_organization_id_idx" ON "quota_audit_entries"("organization_id");
CREATE INDEX IF NOT EXISTS "quota_audit_entries_created_at_idx" ON "quota_audit_entries"("created_at");

ALTER TABLE "quota_audit_entries" DROP CONSTRAINT IF EXISTS "quota_audit_entries_organization_id_fkey";
ALTER TABLE "quota_audit_entries" ADD CONSTRAINT "quota_audit_entries_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
