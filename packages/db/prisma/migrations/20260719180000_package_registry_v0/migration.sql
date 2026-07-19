-- Phase 22: Package Registry (DP4) — packages, package_versions, tenant_packages

CREATE TABLE "packages" (
    "package_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "publisher" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "capability_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "packages_pkey" PRIMARY KEY ("package_id")
);

CREATE TABLE "package_versions" (
    "id" UUID NOT NULL,
    "package_id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "manifest" JSONB NOT NULL,
    "published_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tenant_packages" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "package_id" TEXT NOT NULL,
    "pinned_version" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'installed',
    "installed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uninstalled_at" TIMESTAMPTZ(3),
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "tenant_packages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "packages_kind_idx" ON "packages"("kind");
CREATE INDEX "packages_capability_id_idx" ON "packages"("capability_id");

CREATE UNIQUE INDEX "package_versions_package_id_version_key" ON "package_versions"("package_id", "version");
CREATE INDEX "package_versions_package_id_idx" ON "package_versions"("package_id");

CREATE UNIQUE INDEX "tenant_packages_organization_id_package_id_key" ON "tenant_packages"("organization_id", "package_id");
CREATE INDEX "tenant_packages_organization_id_idx" ON "tenant_packages"("organization_id");
CREATE INDEX "tenant_packages_package_id_idx" ON "tenant_packages"("package_id");
CREATE INDEX "tenant_packages_status_idx" ON "tenant_packages"("status");

ALTER TABLE "package_versions" ADD CONSTRAINT "package_versions_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("package_id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_packages" ADD CONSTRAINT "tenant_packages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_packages" ADD CONSTRAINT "tenant_packages_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "packages"("package_id") ON DELETE RESTRICT ON UPDATE CASCADE;
