# Cost matrix (Phase 21 / DO12)

| # | Case | Expected |
|---|------|----------|
| 1 | LLM complete under budget | OK · usage persisted with `estimated_usd` + `pricing_version` |
| 2 | Exhausted budget before call | `BUDGET_EXCEEDED` |
| 3 | Call that exceeds `max_tokens` | `BUDGET_EXCEEDED` (post-check) |
| 4 | `getBudget` reflects spend | remaining decreases |
| 5 | `estimate` deterministic for same profile/tokens | identical USD |
| 6 | Same Rate Card scenario twice | identical `estimated_usd` |
| 7 | Adam + Nova share `run_id` ledger | combined spend |
| 8 | Missing `budget_snapshot` | refused |
| 9 | `GET /runs/:id/cost` | aggregates from `llm_usages` only |
| 10 | Timeline / API same SoT | both read `llm_usages` (+ snapshot ceilings) |

Automated by `cost-engine.test.ts`, `llm.test.ts`, Runtime LLM paths.
