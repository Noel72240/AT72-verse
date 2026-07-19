# Verse Kernel — syscalls v0

Catalog of the public `KernelClient` surface (from `@at72-verse/contracts`, implemented by `@at72-verse/verse-kernel`).

Agents and skills call these APIs only. They never configure transport (ADR-002).

## Execution context (auto-injected)

Provided when the runtime creates the client via `createKernelClient({ context })`. Propagated into instrumentation on every syscall — **not** accepted as method parameters from agents:

| Field | Meaning |
|-------|---------|
| `run_id` | Execution run |
| `trace_id` | Distributed trace |
| `span_id` | Current span |
| `agent_id` | Calling agent |
| `organization_id` | Tenant / billing org (`tenant_id` alias kept for freeze-v0) |
| `workspace_id` | Workspace |
| `user_id` | End user, or `null` for system runs |

## Families

| Family | Methods |
|--------|---------|
| `llm` | `complete`, `stream`, `embed` |
| `memory` | `remember`, `recall`, `summarize`, `forget`, `pin`, `link` |
| `tools` | `execute`, `listAvailable` |
| `skills` | `invoke`, `resolve` |
| `persona` | `resolve` |
| `orchestration` | `delegate` (await · Phase 15), `ask`, `completeTask`, `requestHitl` (stubs) |
| `events` | `emit` |
| `artifacts` | `write`, `read`, `list` |
| `cost` | `estimate`, `getBudget` |
| `registry` | `getAgent`, `getSkill`, `getTool` |
| `files` | `upload`, `download` |

## Errors

Failures surface as `KernelError` with `code` ∈  
`UNAUTHORIZED` · `FORBIDDEN` · `NOT_FOUND` · `INVALID_INPUT` · `BUDGET_EXCEEDED` · `UNAVAILABLE` · `INTERNAL`.

## Instrumentation (internal)

Each syscall may record duration, optional cost, success/failure, normalized errors, and context metadata **without** changing the public `KernelClient` API. The stub exposes `getCallHistory()` for tests.

## Phase status

- **Phase 07:** deterministic in-memory stub.
- **Phase 08:** same API; optional in-process Core backend (`VERSE_KERNEL_BACKEND=core` + host `coreFactory`). Stub remains the CI/test reference. Agents never see which backend is active.
