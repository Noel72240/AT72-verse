# `@at72-verse/verse-core`

Verse Core — **runtime host** library (ADR-001). Embedded in the API process at MVP behind a **minimal public façade**.

## Public API (Decision J1 / K)

Hosts (`apps/api`) import **only** from the package root:

```ts
import { createVerseCore } from "@at72-verse/verse-core";

const core = createVerseCore({ kernelBackend: "stub" });
const health = await core.health();
const kernel = core.createKernelClient(context); // host / Kernel factory only
```

Agents **never** import this package. They use `@at72-verse/verse-kernel` only.

## Non-goals (Phase 08)

- No Adam-specific (or any agent-specific) logic
- No imports from `agents/**`
- No business logic dumped into `VerseCore` — it **orchestrates modules + adapters**

## Modules

Logical modules from ARCHITECTURE §5.4 are registered in the manifest and surfaced by `health()`:

```mermaid
flowchart TB
  API["apps/api"]
  FC["VerseCore façade"]
  subgraph modules [Core modules]
    ORCH[orchestration]
    ROUTE[routing]
    LLM[llm]
    MEM[memory]
    EV[events]
    AD[adapters]
  end
  subgraph adapters [Adapter ports]
    A_LLM[LlmAdapter]
    A_MEM[MemoryAdapter]
    A_BUS[BusAdapter]
    A_DB[DatabaseAdapter]
    A_OBJ[ObjectStorageAdapter]
    A_VEC[VectorAdapter]
  end
  API --> FC
  FC --> modules
  FC --> adapters
  AD --> A_LLM & A_MEM & A_BUS & A_DB & A_OBJ & A_VEC
```

Phase 08 ships **noop** adapters that implement the definitive ports so future real providers swap transparently.

## Health (`GET /health/core`)

`health()` returns an extensible report: status, version, uptime, modules, adapters, active Kernel backend.

## Kernel backend (Decision L2)

Core can produce an in-process `KernelClient` for `VERSE_KERNEL_BACKEND=core`. The stub backend remains the CI/test reference; selection stays inside the Kernel factory — agents never see it.
