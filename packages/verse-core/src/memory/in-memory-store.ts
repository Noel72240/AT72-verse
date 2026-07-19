/**
 * Process-local MemoryStorePort (tests + default when no DATABASE_URL).
 * Not for multi-process production — use Prisma store (DL1).
 */
import type { MemoryRecord } from "@at72-verse/contracts";
import type { MemoryStorePort, MemoryStoreQuery } from "./memory-store-port.js";
import { KernelError } from "@at72-verse/verse-kernel";

function matchesQuery(content: string, query: string): boolean {
  if (!query) return true;
  return content.toLowerCase().includes(query.toLowerCase());
}

export class InMemoryMemoryStore implements MemoryStorePort {
  private readonly rows = new Map<string, MemoryRecord>();

  async insert(record: MemoryRecord): Promise<MemoryRecord> {
    const frozen = Object.freeze({
      ...record,
      pinned: record.pinned ?? false,
      deleted_at: record.deleted_at ?? null,
    }) as MemoryRecord;
    this.rows.set(frozen.id, frozen);
    return frozen;
  }

  async query(filter: MemoryStoreQuery): Promise<MemoryRecord[]> {
    const excludeDeleted = filter.exclude_deleted !== false;
    const out: MemoryRecord[] = [];
    for (const row of this.rows.values()) {
      if (row.organization_id !== filter.organization_id) continue;
      if (excludeDeleted && row.deleted_at) continue;
      if (filter.workspace_id && row.workspace_id !== filter.workspace_id) continue;
      if (filter.scope && row.scope !== filter.scope) continue;
      if (filter.layer && row.layer !== filter.layer) continue;
      if (filter.run_id !== undefined && filter.run_id !== null && row.run_id !== filter.run_id) {
        continue;
      }
      if (
        filter.conversation_id !== undefined &&
        filter.conversation_id !== null &&
        row.conversation_id !== filter.conversation_id
      ) {
        continue;
      }
      if (filter.user_id !== undefined) {
        if (filter.user_id === null) {
          if (row.user_id !== null) continue;
        } else if (row.user_id !== filter.user_id) {
          continue;
        }
      }
      if (!matchesQuery(row.content, filter.query)) continue;
      out.push(row);
    }
    out.sort((a, b) => {
      const pin = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
      if (pin !== 0) return pin;
      const t = a.created_at.localeCompare(b.created_at);
      return t !== 0 ? t : a.id.localeCompare(b.id);
    });
    return out.slice(0, filter.limit);
  }

  async getById(id: string, organizationId: string): Promise<MemoryRecord | null> {
    const row = this.rows.get(id);
    if (!row || row.organization_id !== organizationId) return null;
    return row;
  }

  async setPinned(id: string, organizationId: string, pinned: boolean): Promise<MemoryRecord> {
    const row = await this.getById(id, organizationId);
    if (!row || row.deleted_at) {
      throw new KernelError("NOT_FOUND", `Memory record not found: ${id}`);
    }
    const next = Object.freeze({ ...row, pinned }) as MemoryRecord;
    this.rows.set(id, next);
    return next;
  }

  async softDelete(id: string, organizationId: string): Promise<void> {
    const row = await this.getById(id, organizationId);
    if (!row) {
      throw new KernelError("NOT_FOUND", `Memory record not found: ${id}`);
    }
    this.rows.set(
      id,
      Object.freeze({ ...row, deleted_at: new Date().toISOString() }) as MemoryRecord,
    );
  }

  /** Test helper */
  clear(): void {
    this.rows.clear();
  }

  size(): number {
    return this.rows.size;
  }
}
