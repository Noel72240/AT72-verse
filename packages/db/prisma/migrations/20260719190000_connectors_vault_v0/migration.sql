-- Phase 28a — Secrets vault ciphertext + connector connection metadata (ADR-013)

CREATE TABLE "vault_secrets" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "ref" TEXT NOT NULL,
    "ciphertext" TEXT NOT NULL,
    "iv" TEXT NOT NULL,
    "auth_tag" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "vault_secrets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "vault_secrets_workspace_id_ref_key" ON "vault_secrets"("workspace_id", "ref");
CREATE INDEX "vault_secrets_organization_id_idx" ON "vault_secrets"("organization_id");
CREATE INDEX "vault_secrets_workspace_id_idx" ON "vault_secrets"("workspace_id");

ALTER TABLE "vault_secrets" ADD CONSTRAINT "vault_secrets_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "vault_secrets" ADD CONSTRAINT "vault_secrets_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "connector_connections" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "workspace_id" UUID NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "vault_ref" TEXT NOT NULL,
    "external_account_hint" TEXT,
    "connected_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "connector_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "connector_connections_workspace_id_provider_key" ON "connector_connections"("workspace_id", "provider");
CREATE INDEX "connector_connections_organization_id_idx" ON "connector_connections"("organization_id");
CREATE INDEX "connector_connections_workspace_id_idx" ON "connector_connections"("workspace_id");
CREATE INDEX "connector_connections_provider_idx" ON "connector_connections"("provider");

ALTER TABLE "connector_connections" ADD CONSTRAINT "connector_connections_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "connector_connections" ADD CONSTRAINT "connector_connections_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
