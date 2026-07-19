-- Phase 17: persona org/workspace overrides (ADR-010)
CREATE TABLE "persona_overrides" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workspace_id" UUID,
    "agent_id" TEXT NOT NULL,
    "patch" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "persona_overrides_pkey" PRIMARY KEY ("id")
);

-- NULL workspace_id = org-scoped (partial unique)
CREATE UNIQUE INDEX "persona_overrides_org_agent_uidx"
  ON "persona_overrides" ("organization_id", "agent_id")
  WHERE "workspace_id" IS NULL;

CREATE UNIQUE INDEX "persona_overrides_ws_agent_uidx"
  ON "persona_overrides" ("organization_id", "workspace_id", "agent_id")
  WHERE "workspace_id" IS NOT NULL;

CREATE INDEX "persona_overrides_organization_id_idx" ON "persona_overrides"("organization_id");
CREATE INDEX "persona_overrides_workspace_id_idx" ON "persona_overrides"("workspace_id");
CREATE INDEX "persona_overrides_agent_id_idx" ON "persona_overrides"("agent_id");

ALTER TABLE "persona_overrides" ADD CONSTRAINT "persona_overrides_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "persona_overrides" ADD CONSTRAINT "persona_overrides_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
