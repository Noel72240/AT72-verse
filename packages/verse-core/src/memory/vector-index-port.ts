/**
 * Vector index port (Phase 25 / ADR-007).
 * Implementations: in-memory (tests) · pgvector (Postgres).
 * Kernel never depends on this — Memory Gateway only.
 */
export const MEMORY_EMBEDDING_DIMS = 64 as const;
export const MEMORY_EMBEDDING_MODEL_STUB = "stub-embed-v1" as const;

export type VectorUpsertInput = {
  memory_id: string;
  organization_id: string;
  scope: string;
  embedding: number[];
  model: string;
  dims: number;
};

export type VectorSearchHit = {
  memory_id: string;
  /** Cosine distance in [0, 2], rounded to 6 decimals. */
  distance: number;
  /** Similarity = 1 - distance/2 mapped… we use score = max(0, 1 - distance) with unit vectors. */
  score: number;
};

export type VectorSearchInput = {
  organization_id: string;
  scope?: string;
  query_embedding: number[];
  limit: number;
};

export type VectorIndexPort = {
  upsert(input: VectorUpsertInput): Promise<void>;
  search(input: VectorSearchInput): Promise<VectorSearchHit[]>;
  deleteByMemoryId(memoryId: string): Promise<void>;
  deleteByOrganization(organizationId: string): Promise<void>;
};

/** Round to 6 decimals — deterministic score contract. */
export function roundScore(value: number): number {
  return Number(value.toFixed(6));
}

/** Cosine distance for unit-ish vectors; deterministic. */
export function cosineDistance(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 1;
  const sim = dot / (Math.sqrt(na) * Math.sqrt(nb));
  return roundScore(1 - sim);
}

export function distanceToScore(distance: number): number {
  return roundScore(Math.max(0, Math.min(1, 1 - distance)));
}
