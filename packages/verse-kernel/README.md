# @at72-verse/verse-kernel

Verse Kernel client library (**ADR-002**, Phases 07–08).

## Rules

- Types are defined **only** in `@at72-verse/contracts` and re-exported here (Decision G1).
- Agents / skills depend on this package (and contracts) for I/O — never Prisma, LLM SDKs, Redis, Core internals, etc.
- Transport / backend is **opaque**: `createKernelClient()` selects the binding internally. Agents never pass or observe the backend.

## Dual backend (Decision L2)

| Backend | Role |
|---------|------|
| `stub` (default) | Deterministic in-memory stub — **CI / unit reference** |
| `core` | In-process Core binding via host `coreFactory` — wiring demo only |

Selection: option `backend` (host-only) or env `VERSE_KERNEL_BACKEND`. When `core`, the host must supply `coreFactory` (typically `core.createKernelClient`).

```ts
import { createKernelClient } from "@at72-verse/verse-kernel";
import { createVerseCore } from "@at72-verse/verse-core";

const core = createVerseCore({ kernelBackend: "core" });
const kernel = createKernelClient({
  context: { /* … */ },
  backend: "core",
  coreFactory: (ctx) => core.createKernelClient(ctx),
});
```

## Surface

```ts
import { createKernelClient } from "@at72-verse/verse-kernel";

const kernel = createKernelClient({
  context: {
    run_id: "...",
    agent_id: "nova",
    organization_id: "...",
    workspace_id: "...",
    user_id: "...", // or null
  },
});

await kernel.llm.complete({ profile: "creative-balanced", messages: [...] });
```

Context is injected by the runtime — **never** passed as syscall arguments by agents.

## Stub

`StubKernelClient` records call history (`getCallHistory()`) for tests. See `docs/agents/kernel-syscalls.md`.

## Fake agent cycle

`runFakeAgentCycle` / `runFakeAgentDemo` : LLM → remember → recall → emit (uses stub by default).
