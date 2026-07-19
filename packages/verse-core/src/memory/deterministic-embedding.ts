/**
 * Deterministic stub embeddings (Phase 25 / DS3).
 * Same text → same unit vector (dims fixed). Used by CI and when no provider embed.
 */
import { createHash } from "node:crypto";
import { MEMORY_EMBEDDING_DIMS } from "./vector-index-port.js";

export function deterministicEmbedding(
  text: string,
  dims: number = MEMORY_EMBEDDING_DIMS,
): number[] {
  const out = new Array<number>(dims).fill(0);
  const seed = createHash("sha256").update(text).digest();
  for (let i = 0; i < dims; i++) {
    const b = seed[i % seed.length]!;
    const b2 = seed[(i * 7 + 3) % seed.length]!;
    out[i] = ((b / 255) * 2 - 1) * 0.5 + ((b2 / 255) * 2 - 1) * 0.5;
  }
  // L2 normalize for stable cosine
  let norm = 0;
  for (const v of out) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return out.map((v) => Number((v / norm).toFixed(8)));
}
