/**
 * Conversation summarizer port (Phase 18 / DL8).
 * Deterministic today; swappable for LLM without changing Kernel.memory.summarize API.
 */
import type { MemoryRecord } from "@at72-verse/contracts";

export type ConversationSummarizerPort = {
  readonly strategy_id: string;
  summarize(input: {
    scope: string;
    records: MemoryRecord[];
  }): Promise<string>;
};

/**
 * Extractive / concat summary — no LLM, no similarity scores (DL7 · déterministe).
 */
export class DeterministicConversationSummarizer implements ConversationSummarizerPort {
  readonly strategy_id = "deterministic-concat-v1";

  async summarize(input: { scope: string; records: MemoryRecord[] }): Promise<string> {
    if (input.records.length === 0) {
      return `(empty:${input.scope})`;
    }
    const parts = input.records.map((r, i) => `[${i + 1}] ${r.content.trim()}`);
    const joined = parts.join("\n");
    const max = 4000;
    if (joined.length <= max) {
      return joined;
    }
    return `${joined.slice(0, max)}…`;
  }
}
