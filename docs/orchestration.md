# Orchestration (Phase 15 · 24)

Decisions **BM1–BX1** · **DR1–DR10** · `OrchestrationHostPort` (BO1 · BP1 · DR2 · DR6)

## Flow — single delegate

```text
POST /runs { target_agent: adam, goal: "Rédige un post LinkedIn…" }
  → Bus verse.agent.adam.tasks
Adam.handleTask
  → Kernel.llm.complete (orchestrate-precise) → plan
  → Kernel.orchestration.delegate({ target_agent: nova, task })
       Core → OrchestrationHostPort (Runtime)
         1. publish task.delegated  → API creates Nova RunStep (parent_step_id)
         2. execute Nova in-process (P15)
         3. publish task.completed  → project Nova step
         4. return { step_id, status, result?, error? }
  → pass-through result (no polish)
  → Adam task.completed
```

## Flow — campaign fan-out / fan-in (Phase 24)

```text
Adam.handleTask (mode campaign)
  → Kernel.orchestration.delegateMany({ targets: [nova, astra, pixel] })
       Host: Promise.all(delegate…) — results ordered as targets (not finish order)
         · siblings share parent_step_id (Timeline DR9)
         · CostEngine.runExclusive(run_id) serializes LLM budget assert+record (DR8)
  → aggregate { nova, astra, pixel } (deterministic, no LLM polish — DR3)
  → all-or-nothing: any specialist failed → Adam failed (DR5)
```

## Flow — Ask / Consult (Phase 24)

```text
Nova.handleTask (consult_seo)
  → Kernel.orchestration.ask("astra", question)
       Gates: can_consult ∩ package install ∩ grant (DR6)
       publish task.consulted → API RunStep kind=consult
       execute target with orchestration_locked=true
         · does NOT increment delegation_depth
         · cannot call delegate / delegateMany / ask
  → merge answer into result (never a nested orchestration)
```

## Boundaries

| Layer | Role |
|-------|------|
| Adam | Orchestrates — `delegate` / `delegateMany` only — never Skills |
| Specialists | May `ask` if `can_consult` — never `delegate*` (DR7) |
| Runtime | Hosts agents + `OrchestrationHostPort` + SkillHost — Host stays generic |
| Core | Forwards orchestration to host — never imports `agents/*` · Cost mutex internal |
| API | Sole mutator of Runs / RunSteps · projects `task.delegated` + `task.consulted` |

## OrchestrationHostPort

```ts
delegate(request): Promise<OrchestrationDelegateResult>
delegateMany(request): Promise<{ results }>  // order = targets order
ask(request): Promise<OrchestrationAskResult>
```

- **P15:** in-process after recording the child step.
- **P24:** `delegateMany` = parallel `delegate`; `ask` = consult without depth bump.
- Auto-propagates `run_id`, `trace_id`, `parent_step_id` from Kernel context.
- Guards: `max_delegation_depth = 1`, allow-list from **Runtime agent registry** (`adam →` specialists). Package install remains `packages_snapshot` gate.

## Separation (confirmed)

| Concern | Source of truth |
|---------|-----------------|
| Adam allow-list | Runtime Agent Registry |
| Install / uninstall gate | Package Registry via `packages_snapshot` |

## Failure cascade (BR1 · DR5)

```text
Any campaign specialist failed → Adam failed → Run failed
Consult failed / forbidden → caller failed
```

No automatic retry · no HITL · no declarative workflows in this phase (DR10).

## Post-J13 / Phase 24 constraints

- New specialists: registry + package + persona + skill + grants — no OrchestrationHost edits.
- Replay with same snapshots → same fan-out structure / aggregate keys.
- Parallel branch events fully timeline- and audit-traceable.
- Public `Kernel.cost.*` unchanged (mutex internal to Cost Engine).
