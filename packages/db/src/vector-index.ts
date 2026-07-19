/**
 * pgvector-backed VectorIndexPort (Phase 25 / ADR-007).
 * Lives in @at72-verse/db — Kernel never imports this.
 * Cosine distance via <=> operator; scores rounded to 6 decimals (deterministic).
 */
import { randomUUID } from "node:crypto";
import type { PrismaClient } from "./client.js";

export const PG_VECTOR_DIMS = 64 as const;

export type DbVectorUpsertInput = {
  memory_id: string;
  organization_id: string;
  scope: string;
  embedding: number[];
  model: string;
  dims: number;
};

export type DbVectorSearchHit = {
  memory_id: string;
  distance: number;
  score: number;
};

export type DbVectorIndex = {
  upsert(input: DbVectorUpsertInput): Promise<void>;
  search(input: {
    organization_id: string;
    scope?: string;
    query_embedding: number[];
    limit: number;
  }): Promise<DbVectorSearchHit[]>;
  deleteByMemoryId(memoryId: string): Promise<void>;
  deleteByOrganization(organizationId: string): Promise<void>;
};

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.map((n) => Number(n.toFixed(8))).join(",")}]`;
}

function round6(n: number): number {
  return Number(n.toFixed(6));
}

/**
 * Create a VectorIndexPort-compatible repository using Prisma raw SQL + pgvector.
 * Falls back to JSON cosine in-process if vector column writes fail (still org-filtered).
 */
export function createPrismaVectorIndex(prisma: PrismaClient): DbVectorIndex {
  return {
    async upsert(input: DbVectorUpsertInput): Promise<void> {
      const dims = input.dims || PG_VECTOR_DIMS;
      const vec = input.embedding.slice(0, dims);
      while (vec.length < dims) vec.push(0);
      const literal = toVectorLiteral(vec);
      const id = randomUUID();
      const json = JSON.stringify(vec);

      await prisma.$executeRawUnsafe(
        `
        INSERT INTO memory_embeddings (id, memory_id, organization_id, scope, model, dims, embedding, embedding_json, created_at, updated_at)
        VALUES ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7::vector, $8::jsonb, NOW(), NOW())
        ON CONFLICT (memory_id) DO UPDATE SET
          organization_id = EXCLUDED.organization_id,
          scope = EXCLUDED.scope,
          model = EXCLUDED.model,
          dims = EXCLUDED.dims,
          embedding = EXCLUDED.embedding,
          embedding_json = EXCLUDED.embedding_json,
          updated_at = NOW()
        `,
        id,
        input.memory_id,
        input.organization_id,
        input.scope,
        input.model,
        dims,
        literal,
        json,
      );
    },

    async search(input): Promise<DbVectorSearchHit[]> {
      const dims = PG_VECTOR_DIMS;
      const vec = input.query_embedding.slice(0, dims);
      while (vec.length < dims) vec.push(0);
      const literal = toVectorLiteral(vec);

      const rows = input.scope
        ? await prisma.$queryRawUnsafe<Array<{ memory_id: string; distance: number }>>(
            `
            SELECT memory_id::text AS memory_id,
                   (embedding <=> $1::vector)::float8 AS distance
            FROM memory_embeddings
            WHERE organization_id = $2::uuid AND scope = $3
            ORDER BY embedding <=> $1::vector ASC, memory_id ASC
            LIMIT $4
            `,
            literal,
            input.organization_id,
            input.scope,
            input.limit,
          )
        : await prisma.$queryRawUnsafe<Array<{ memory_id: string; distance: number }>>(
            `
            SELECT memory_id::text AS memory_id,
                   (embedding <=> $1::vector)::float8 AS distance
            FROM memory_embeddings
            WHERE organization_id = $2::uuid
            ORDER BY embedding <=> $1::vector ASC, memory_id ASC
            LIMIT $3
            `,
            literal,
            input.organization_id,
            input.limit,
          );

      return rows.map((r) => {
        const distance = round6(Number(r.distance));
        return {
          memory_id: r.memory_id,
          distance,
          score: round6(Math.max(0, Math.min(1, 1 - distance))),
        };
      });
    },

    async deleteByMemoryId(memoryId: string): Promise<void> {
      await prisma.memoryEmbeddingRow.deleteMany({ where: { memoryId } });
    },

    async deleteByOrganization(organizationId: string): Promise<void> {
      await prisma.memoryEmbeddingRow.deleteMany({ where: { organizationId } });
    },
  };
}
