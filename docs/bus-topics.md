# Bus topics (public architecture)

**Phase 10** · Decision **U2** · ADR-003

Topic names are part of the **public architecture**. Prefer helpers from `@at72-verse/bus` (`runsTopic`, `agentTasksTopic`, …) instead of string literals.

## Active patterns

| Pattern | Example | Role |
|---------|---------|------|
| `verse.runs.*` | `verse.runs.created` | Run lifecycle / orchestration events |
| `verse.agent.{agentId}.tasks` | `verse.agent.nova.tasks` | Task assignments for a given agent |
| `verse.dlq` | `verse.dlq` | Dead-letter placeholder (W1) |

### Phase 12 agent topics

| Topic | Role |
|-------|------|
| `verse.agent.{agentId}.tasks` | Dispatch work to an agent (AJ1) |
| `verse.agent.{agentId}.events` | Agent signals e.g. `task.completed` (AP3) |

Task payload (AK1): `run_id`, `trace_id`, optional `step_id`, `goal`. Envelope always sets `run_id`.

### Phase 13 LLM usage

| Topic | Role |
|-------|------|
| `verse.llm.usage` | Core publishes `llm.usage.recorded` after each `llm.complete` (AW2) |

Payload includes `llm_call_id`, `run_id`, `trace_id`, `profile`, `provider`, `model`, tokens, `credential_source`. API projector persists to `llm_usages`.

## Reserved prefixes (unused in Phase 10)

Reserved now to avoid future breaking renames:

| Prefix | Intended use |
|--------|----------------|
| `verse.system.*` | Platform / control-plane events |
| `verse.audit.*` | Audit trail |
| `verse.metrics.*` | Metering / metrics signals |

## Envelope rules

- Every `BusMessage` **must** include schema `version` (validated at publish).
- Messages are **immutable** after publish (deep-frozen).
- Handlers **must ignore unknown fields** without error (forward compatibility).
- Idempotency: consumers dedupe on `event_id` (per consumer group) — Decision V1.
- Agents never publish to topics directly — Kernel / Core / hosts only (Phase 09 boundaries).

## DLQ

`verse.dlq` receives `BusMessage` envelopes with the **same shape** as normal events. Phase 10 payload convention:

- `event_type`: `system.dlq.dead_letter`
- `version`: `1`
- `causation_id`: original `event_id`
- `payload.original`: original message
- `payload.reason`: error string

## Ops surface

```ts
import {
  createBus,
  runsTopic,
  agentTasksTopic,
  TOPIC_DLQ,
} from "@at72-verse/bus";

const bus = createBus({ backend: "memory" }); // or redis via REDIS_URL
await bus.publish(message, { topic: runsTopic("created") });
```
