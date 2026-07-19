-- Phase 20 / DN3 — Workspace capability grants
CREATE TABLE "capability_grants" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "capability_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "capability_grants_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "capability_grants" ADD CONSTRAINT "capability_grants_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "capability_grants" ADD CONSTRAINT "capability_grants_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "capability_grants_workspace_id_kind_capability_id_key" ON "capability_grants"("workspace_id", "kind", "capability_id");
CREATE INDEX "capability_grants_organization_id_idx" ON "capability_grants"("organization_id");
CREATE INDEX "capability_grants_workspace_id_idx" ON "capability_grants"("workspace_id");
CREATE INDEX "capability_grants_kind_capability_id_idx" ON "capability_grants"("kind", "capability_id");
