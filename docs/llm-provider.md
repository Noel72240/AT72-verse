# LLM Provider & Model Profiles (Phase 13)

Decisions **AR1 · AS1 · AT1/AT3 · AU2 · AV1 · AW2 · AX1 · AY1 · AZ1**

## Flow

```text
Host (API or agent-runtime)
  → createVerseCore({ bus })  // ManagedLlmAdapter when OPENAI_API_KEY set
  → createKernelClient({ backend: "core", coreFactory })
  → kernel.llm.complete({ profile, messages })
       → Model Router (Core) profile → provider/model
       → Credential Resolver → platform key (credential_source=platform)
       → OpenAiProviderAdapter (sole openai import)
       → bus verse.llm.usage  event_type=llm.usage.recorded
API LlmUsageProjectorService
  → persist llm_usages (Prisma)
```

## Profiles (contracts)

| Profile | Routed model (OpenAI) |
|---------|------------------------|
| `fast-cheap` | `gpt-4o-mini` |
| `orchestrate-precise` | `gpt-4o` |
| `creative-balanced` | `gpt-4o` |

## Explicitly unavailable

- `Kernel.llm.stream` → `KernelError UNAVAILABLE` (no fake streaming)
- `Kernel.llm.embed` → `KernelError UNAVAILABLE` (out of scope)

## Boundaries

- Runtime hosts `@at72-verse/verse-core` façade only (AR1)
- `openai` SDK only inside `packages/verse-core` (AS1 · AZ1)
- Adam stays deterministic; LLM proof = harness outside Adam (AX1)
- Core never writes `llm_usages` — Bus event → API projector (AW2)
- Phase 21 : each usage carries `estimated_usd` + `pricing_version` (Cost Engine Rate Card)

## Env

```bash
OPENAI_API_KEY=sk-...   # or LLM_API_KEY
# optional alias
```

## Local proof (no real key)

Unit/harness tests use a fake `LlmProviderAdapter`. With a real key, Managed adapter calls OpenAI.
