# Workflows (Phase 26)

Décisions **DT1–DT12** · ADR-006 · post-J14 / post-J15 · **J16 atteint**

**Post-J16 :** Engine = orchestrateur Core uniquement · Skills/Agents indépendants du moteur · Agents portent l’intelligence métier · nœuds futurs via handlers.

## Rôle

Exécuter un **process métier déclaratif** hors chat libre.

| Composant | Rôle |
|-----------|------|
| **Workflow Engine** (Core) | Interprète le graphe — **aucune** logique métier |
| **Agents** | Toute l’intelligence (Nova, Astra, Pixel…) |
| **Kernel** | `delegate` / `delegateMany` / `ask` / `memory.*` — seules primitives d’orchestration |
| **Runtime** | Host + bus consumer `verse.workflow.tasks` |
| **API** | Persistence `workflow_runs` · trigger manual · resume |

## content-campaign (MVP)

```text
ingest_brief (memory_remember)
  → specialists (fan_out: nova, astra, pixel)   ← delegateMany
  → review_gate (checkpoint) → status waiting_checkpoint
  → [resume manuel]
  → finalize (noop) → completed
```

- Pas de retry automatique.
- États : `queued` · `running` · `waiting_checkpoint` · `paused` · `completed` · `failed`.

## Extensibilité

Nouveaux nœuds via `WorkflowEngine.registerHandler(kind, handler)` sans réécrire la boucle :

- futurs : `condition` · `loop` · `wait_event` · `hitl` · `ask`

Kinds P26 : `memory_remember` · `fan_out` · `delegate` · `checkpoint` · `noop`.

## API

- `GET /workflows`
- `POST /workspaces/:id/workflows/:workflowId/run` `{ brief }`
- `GET /workflow-runs/:id`
- `POST /workflow-runs/:id/resume`

## Package

`pkg.workflow.content-campaign` (`kind: workflow`) — gate install via `packages_snapshot`.

## Hors scope

HITL · schedule/webhook · Nyx/Pulse · éditeur graphique · compensation · retries auto
