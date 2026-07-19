/**
 * Per-consumer idempotency store keyed by event_id (Decision V1).
 */
export interface IdempotencyStore {
  /** Returns true if this is the first time seeing the key (should process). */
  tryClaim(key: string): Promise<boolean>;
}

export class MemoryIdempotencyStore implements IdempotencyStore {
  private readonly seen = new Set<string>();

  async tryClaim(key: string): Promise<boolean> {
    if (this.seen.has(key)) return false;
    this.seen.add(key);
    return true;
  }

  /** Test helper */
  clear(): void {
    this.seen.clear();
  }
}

type RedisSetClient = {
  set(
    key: string,
    value: string,
    secondsToken: "EX",
    seconds: number,
    nx: "NX",
  ): Promise<"OK" | null>;
};

/** Redis SET NX EX — used by RedisStreamsBus. */
export class RedisIdempotencyStore implements IdempotencyStore {
  constructor(
    private readonly redis: RedisSetClient,
    private readonly keyPrefix = "verse:bus:idem:",
    private readonly ttlSeconds = 86_400,
  ) {}

  async tryClaim(key: string): Promise<boolean> {
    const result = await this.redis.set(
      `${this.keyPrefix}${key}`,
      "1",
      "EX",
      this.ttlSeconds,
      "NX",
    );
    return result === "OK";
  }
}
