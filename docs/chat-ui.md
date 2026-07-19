# Chat UI & Run streaming (Phase 16)

Decisions **CA1–CK1**

## Architecture

```text
apps/web (Next.js 15)  --HTTP only-->  apps/api (Nest)
                                         ├─ conversations / messages / runs
                                         ├─ GET /runs/:id/stream  (SSE métier)
                                         └─ projectAgentTaskCompleted
                                              → assistant message + run completed
apps/agent-runtime  --Bus-->  API projectors
```

## Boundaries

- Web never imports Core, Runtime, agents, Prisma
- State reconstitution: Conversation + Messages + Runs/Steps APIs only
- SSE reconnect: REST snapshot then re-open stream (no hidden client cache as source of truth)

## SSE events

| Event | Meaning |
|-------|---------|
| `snapshot` | Current run + steps on connect |
| `step_created` | New RunStep |
| `status_changed` | Non-terminal status |
| `run_completed` | Terminal success (+ optional message/result) |
| `run_failed` | Terminal failure |
| `heartbeat` | Keep-alive |

No token deltas. `Kernel.llm.stream` remains future work.

## Demo

See [`demo-phase16.md`](./demo-phase16.md).
