import { createHash } from "node:crypto";

/** Stable hash for deterministic stub outputs (Decision H1). */
export function stableHash(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export function deterministicTokenCount(text: string): number {
  const words = text.trim().length === 0 ? 0 : text.trim().split(/\s+/).length;
  return Math.max(1, words);
}

/** Fixed 4-dim pseudo-embedding derived from hash (deterministic). */
export function deterministicEmbedding(text: string): number[] {
  const h = stableHash(text);
  const dims: number[] = [];
  for (let i = 0; i < 4; i += 1) {
    const slice = h.slice(i * 8, i * 8 + 8);
    dims.push(Number.parseInt(slice, 16) / 0xffffffff);
  }
  return dims;
}
