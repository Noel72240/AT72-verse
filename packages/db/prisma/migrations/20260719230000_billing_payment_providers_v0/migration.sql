-- Phase 34: organization billing + payment events (provider-agnostic)

CREATE TABLE IF NOT EXISTS "organization_billing" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'sumup',
    "status" TEXT NOT NULL DEFAULT 'none',
    "provider_customer_id" TEXT,
    "provider_subscription_id" TEXT,
    "current_period_end" TIMESTAMPTZ(3),
    "grace_until" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organization_billing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "organization_billing_organization_id_key" ON "organization_billing"("organization_id");
CREATE INDEX IF NOT EXISTS "organization_billing_status_idx" ON "organization_billing"("status");
CREATE INDEX IF NOT EXISTS "organization_billing_provider_customer_id_idx" ON "organization_billing"("provider_customer_id");

ALTER TABLE "organization_billing" DROP CONSTRAINT IF EXISTS "organization_billing_organization_id_fkey";
ALTER TABLE "organization_billing" ADD CONSTRAINT "organization_billing_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "payment_events" (
    "id" UUID NOT NULL,
    "event_id" TEXT NOT NULL,
    "organization_id" UUID,
    "provider" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload_summary" JSONB NOT NULL DEFAULT '{}',
    "processed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payment_events_event_id_key" ON "payment_events"("event_id");
CREATE INDEX IF NOT EXISTS "payment_events_organization_id_idx" ON "payment_events"("organization_id");
CREATE INDEX IF NOT EXISTS "payment_events_type_idx" ON "payment_events"("type");

ALTER TABLE "payment_events" DROP CONSTRAINT IF EXISTS "payment_events_organization_id_fkey";
ALTER TABLE "payment_events" ADD CONSTRAINT "payment_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
