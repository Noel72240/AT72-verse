# Agent: Adam

**Phase 12+ / 15** · orchestrator · `handleTask`

## Role

Platform orchestrator. Plans with LLM (`orchestrate-precise`), delegates to specialists via `Kernel.orchestration.delegate`, aggregates with pass-through (no polish in P15).

Never invokes Skills directly — specialists (e.g. Nova) own skill bindings.

## Plan vision

Adam always materializes a global plan:

1. `analyze_goal`
2. `draft_orchestration_plan`
3. `delegate_<agent>` (when needed)
4. `aggregate_result`

## Delegation (Phase 15)

| Target | Via | Notes |
|--------|-----|-------|
| Nova | `orchestration.delegate` | Writing / LinkedIn / content goals |

Guards: depth ≤ 1 · allow-list `adam → nova` only.

## Tools / Skills

None directly. Orchestration only.

## Golden paths

- `POST /runs` `target_agent=adam` + LinkedIn goal → Nova child step → pass-through content
- Nova failure → Adam failed → Run failed
