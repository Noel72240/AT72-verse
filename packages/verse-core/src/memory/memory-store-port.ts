/**
 * Persistence port for Memory Gateway (Phase 18 / DL1 · Phase 25 L4).
 * Prisma / in-memory / vector backends implement this without changing Kernel.memory.*.
 */
import type { MemoryLayer, MemoryRecord } from "@at72-verse/contracts";

export type MemoryStoreQuery = {
  organization_id: string;
  workspace_id?: string;
  scope?: string;
  layer?: MemoryLayer;
  run_id?: string | null;
  conversation_id?: string | null;
  /** When set, only rows with this user_id (user-scope isolation). */
  user_id?: string | null;
  /** Substring match (case-insensitive). Empty = no content filter. */
  query: string;
  limit: number;
  /** When true (default), exclude soft-deleted rows. */
  exclude_deleted?: boolean;
};

/**
 * Low-level store. Semantic ranking lives in VectorIndexPort + Gateway (ADR-007).
 * Kernel never imports a vector engine.
 */
export type MemoryStorePort = {
  insert(record: MemoryRecord): Promise<MemoryRecord>;
  query(filter: MemoryStoreQuery): Promise<MemoryRecord[]>;
  getById(id: string, organizationId: string): Promise<MemoryRecord | null>;
  setPinned(id: string, organizationId: string, pinned: boolean): Promise<MemoryRecord>;
  softDelete(id: string, organizationId: string): Promise<void>;
};
