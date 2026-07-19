-- Phase 25: Memory L4 + pgvector embeddings (ADR-007)
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "memory_records"
  ADD COLUMN IF NOT EXISTS "pinned" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(3);

CREATE TABLE IF NOT EXISTS "memory_embeddings" (
  "id" UUID NOT NULL,
  "memory_id" UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "scope" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "dims" INTEGER NOT NULL,
  "embedding" vector(64),
  "embedding_json" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "memory_embeddings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "memory_embeddings_memory_id_key" ON "memory_embeddings"("memory_id");
CREATE INDEX IF NOT EXISTS "memory_embeddings_organization_id_scope_idx" ON "memory_embeddings"("organization_id", "scope");

ALTER TABLE "memory_embeddings"
  DROP CONSTRAINT IF EXISTS "memory_embeddings_memory_id_fkey";
ALTER TABLE "memory_embeddings"
  ADD CONSTRAINT "memory_embeddings_memory_id_fkey"
  FOREIGN KEY ("memory_id") REFERENCES "memory_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "memory_embeddings"
  DROP CONSTRAINT IF EXISTS "memory_embeddings_organization_id_fkey";
ALTER TABLE "memory_embeddings"
  ADD CONSTRAINT "memory_embeddings_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
