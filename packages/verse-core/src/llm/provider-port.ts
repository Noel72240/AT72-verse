/**
 * Replaceable LLM provider port (Phase 13).
 * OpenAI today; Anthropic / Gemini / Ollama later without Kernel/agent changes.
 */
import type { KernelContext } from "@at72-verse/contracts";

export type ProviderCompleteInput = {
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  max_tokens?: number;
  llm_call_id: string;
  context: KernelContext;
  apiKey: string;
};

export type ProviderCompleteResult = {
  content: string;
  input_tokens: number;
  output_tokens: number;
};

export interface LlmProviderAdapter {
  readonly id: string;
  complete(input: ProviderCompleteInput): Promise<ProviderCompleteResult>;
}
