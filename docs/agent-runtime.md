# Agent Runtime & Adam (Phase 12+)

Decisions **AI3 · AJ1 · AK1 · AL1 · AM1→AR1 · AN1 · AO1 · AP3 · AQ1** · Phase 15 **BM1–BX1**

## Flow

```text
API createRun(target_agent=adam)
  → persist Run + adam.orchestrate step
  → bus verse.agent.adam.tasks  (run_id + step_id + trace_id)
agent-runtime (hosts Verse Core façade + Skill + Orchestration hosts)
  → Kernel backend=core
  → Adam.handleTask
       → llm.complete (orchestrate-precise) → plan
       → orchestration.delegate → Nova (in-process via OrchestrationHost)
            → skills.invoke(skill.writing)
  → bus verse.agent.{id}.events  task.delegated | task.completed
API RunsProjector
  → materialize child RunSteps (DAG parent_step_id)
  → mark steps completed | failed
```

See also [`orchestration.md`](./orchestration.md).

## Boundaries

- Adam / Nova: `@at72-verse/contracts` + `@at72-verse/verse-kernel` only
- Skills: same allow-list (see `docs/skills.md`)
- Runtime: may import `@at72-verse/verse-core` **façade** (AR1); hosts skill + orchestration registries; no Prisma
- API: sole mutator of Runs / RunSteps / llm_usages
- LLM SDK: never in Runtime or agents — Core adapters only (see `docs/llm-provider.md`)

## Run locally

```bash
pnpm docker:up
pnpm db:migrate
# terminal 1
AUTH_PROVIDER=dev pnpm api:start
# terminal 2
pnpm runtime:start
# then POST /workspaces/:id/runs { "target_agent": "adam", "goal": "Rédige un post LinkedIn sur …" }
```
