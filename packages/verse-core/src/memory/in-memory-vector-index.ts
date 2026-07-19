/**
 * Process-local vector index (tests + default without Postgres).
 * Same cosine math as pgvector path — deterministic scores.
 */
import {
  cosineDistance,
  distanceToScore,
  type VectorIndexPort,
  type VectorSearchHit,
  type VectorSearchInput,
  type VectorUpsertInput,
} from "./vector-index-port.js";

type Row = {
  memory_id: string;
  organization_id: string;
  scope: string;
  embedding: number[];
  model: string;
  dims: number;
};

export class InMemoryVectorIndex implements VectorIndexPort {
  private readonly rows = new Map<string, Row>();

  async upsert(input: VectorUpsertInput): Promise<void> {
    this.rows.set(input.memory_id, {
      memory_id: input.memory_id,
      organization_id: input.organization_id,
      scope: input.scope,
      embedding: [...input.embedding],
      model: input.model,
      dims: input.dims,
    });
  }

  async search(input: VectorSearchInput): Promise<VectorSearchHit[]> {
    const hits: VectorSearchHit[] = [];
    for (const row of this.rows.values()) {
      if (row.organization_id !== input.organization_id) continue;
      if (input.scope && row.scope !== input.scope) continue;
      const distance = cosineDistance(input.query_embedding, row.embedding);
      hits.push({
        memory_id: row.memory_id,
        distance,
        score: distanceToScore(distance),
      });
    }
    hits.sort((a, b) => {
      if (a.score !== b.score) return b.score - a.score;
      return a.memory_id.localeCompare(b.memory_id);
    });
    return hits.slice(0, input.limit);
  }

  async deleteByMemoryId(memoryId: string): Promise<void> {
    this.rows.delete(memoryId);
  }

  async deleteByOrganization(organizationId: string): Promise<void> {
    for (const [id, row] of this.rows) {
      if (row.organization_id === organizationId) this.rows.delete(id);
    }
  }

  /** Test helper */
  size(): number {
    return this.rows.size;
  }

  clear(): void {
    this.rows.clear();
  }
}
