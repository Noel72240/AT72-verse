-- Phase 32: soft delete, audit_events, export_jobs, retention (EC2/EC4/EC6/EC8)

ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(3);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "purge_after" TIMESTAMPTZ(3);
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "soft_delete_grace_days" INTEGER NOT NULL DEFAULT 30;
ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "audit_retention_days" INTEGER NOT NULL DEFAULT 365;

CREATE INDEX IF NOT EXISTS "organizations_deleted_at_idx" ON "organizations"("deleted_at");

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "purge_after" TIMESTAMPTZ(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "anonymized_at" TIMESTAMPTZ(3);

CREATE INDEX IF NOT EXISTS "users_deleted_at_idx" ON "users"("deleted_at");

CREATE TABLE IF NOT EXISTS "audit_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "actor_user_id" UUID,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "audit_events_organization_id_idx" ON "audit_events"("organization_id");
CREATE INDEX IF NOT EXISTS "audit_events_actor_user_id_idx" ON "audit_events"("actor_user_id");
CREATE INDEX IF NOT EXISTS "audit_events_action_idx" ON "audit_events"("action");
CREATE INDEX IF NOT EXISTS "audit_events_created_at_idx" ON "audit_events"("created_at");

ALTER TABLE "audit_events" DROP CONSTRAINT IF EXISTS "audit_events_organization_id_fkey";
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_events" DROP CONSTRAINT IF EXISTS "audit_events_actor_user_id_fkey";
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "export_jobs" (
    "id" UUID NOT NULL,
    "organization_id" UUID,
    "user_id" UUID NOT NULL,
    "scope" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payload" JSONB,
    "error" TEXT,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "completed_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "export_jobs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "export_jobs_user_id_idx" ON "export_jobs"("user_id");
CREATE INDEX IF NOT EXISTS "export_jobs_organization_id_idx" ON "export_jobs"("organization_id");
CREATE INDEX IF NOT EXISTS "export_jobs_status_idx" ON "export_jobs"("status");
CREATE INDEX IF NOT EXISTS "export_jobs_expires_at_idx" ON "export_jobs"("expires_at");

ALTER TABLE "export_jobs" DROP CONSTRAINT IF EXISTS "export_jobs_organization_id_fkey";
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "export_jobs" DROP CONSTRAINT IF EXISTS "export_jobs_user_id_fkey";
ALTER TABLE "export_jobs" ADD CONSTRAINT "export_jobs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
