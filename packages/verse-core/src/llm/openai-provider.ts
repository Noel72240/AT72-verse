/**
 * OpenAI provider adapter (Phase 13 / AS1 · AZ1).
 * Sole module allowed to import the `openai` SDK.
 */
import OpenAI from "openai";
import type {
  LlmProviderAdapter,
  ProviderCompleteInput,
  ProviderCompleteResult,
} from "./provider-port.js";
import { mapProviderError } from "./map-provider-error.js";

export class OpenAiProviderAdapter implements LlmProviderAdapter {
  readonly id = "openai";

  async complete(input: ProviderCompleteInput): Promise<ProviderCompleteResult> {
    const client = new OpenAI({ apiKey: input.apiKey });
    try {
      const response = await client.chat.completions.create({
        model: input.model,
        messages: input.messages,
        max_tokens: input.max_tokens,
      });

      const content = response.choices[0]?.message?.content ?? "";
      return {
        content,
        input_tokens: response.usage?.prompt_tokens ?? 0,
        output_tokens: response.usage?.completion_tokens ?? 0,
      };
    } catch (err) {
      throw mapProviderError(err, this.id);
    }
  }
}
