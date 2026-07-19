# Cost Engine (Phase 21)

Run budgets and deterministic LLM cost estimates.

## Principles (DO1–DO13)

| Decision | Rule |
|----------|------|
| DO1 | Cost Engine in Verse Core — agents never see budget logic |
| DO2 | P21 meters `Kernel.llm.complete` only |
| DO3a | `llm_usages` = sole ledger SoT; aggregates computed at read time (no `run_cost_ledger`) |
| DO4 | Budget scope = Run only |
| DO5 | Platform / workspace defaults + optional run override |
| DO6 | `budget_snapshot` frozen at dispatch (like grants) |
| DO7 | Hard-stop only via Cost Engine → `BUDGET_EXCEEDED` |
| DO8 | Versioned Rate Card in Core — deterministic, no billing API |
| DO9 | Public Kernel APIs unchanged: `estimate()` · `getBudget()` |
| DO10 | Timeline shows run cost / tokens / ceiling (no fake token stream) |
| DO11 | Display tolerance ± rounding |
| DO12 | Test matrix + identical scenario ⇒ identical `estimated_usd` |
| DO13 | Billing / plans / org quotas out of scope |

## Flow

```
API createRun
  → resolve max_usd / max_tokens (override → workspace → platform)
  → buildBudgetSnapshot (pricing_version)
  → persist in run.metadata + stamp on AgentTaskPayload
Runtime
  → KernelContext.budget_snapshot
CoreKernelClient.llm.complete
  → if budget_snapshot present: CostEngine.assertCanStartLlmCall
  → ManagedLlmAdapter (publishes estimated_usd + pricing_version)
  → if budget_snapshot present: CostEngine.recordLlmUsage (in-memory ledger per run_id)
API LlmUsageProjector
  → llm_usages
GET /runs/:id/cost
  → SUM(llm_usages) + snapshot ceilings  (DO3a)
```

## Rate Card

`PLATFORM_RATE_CARD_VERSION` (`2026-07-19.v1`) — model → $/1k input & output.

Every usage row stores `pricing_version` for replay.

## Extensibility

Future Tool / connector costs plug into Cost Engine without changing `Kernel.cost.*` signatures.
