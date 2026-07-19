# Phase 26 — Pack de décisions (DT\*) — soumis PO

**Statut :** Accepted + **Phase validée PO (2026-07-19)** — Jalon **J16** atteint  
**Amendement DT6 :** checkpoints + reprise manuelle · états `paused` / `waiting_checkpoint` · **aucun** retry automatique  
**Contraintes permanentes (post-J16) :** Engine = orchestrateur only · Skills/Agents indépendants du moteur · Agents = intelligence métier · nœuds futurs via handlers

---

## Contexte (état actuel)

- Chat Adam + `delegate` / `delegateMany` / `ask` opérationnels (P15 / P24).
- Campagne Nova+Astra+Pixel = golden fan-out — **et** workflow déclaratif `content-campaign` (P26 livré).
- Définition versionnée `workflows/content-campaign/` (`status: active`).
- Prisma `workflow_definitions` / `workflow_runs` + Runtime bus `verse.workflow.tasks`.
- Workflow Engine Core + registry de handlers (extensible).
- ARCH §20 cite Nyx / Pulse / HITL `schedule` — agents absents ou placeholder (Pulse P27).

---

## Décisions à trancher

### DT1 — Périmètre de phase

**Proposition :** une Phase 26 unique livrant :

1. Workflow Engine minimal dans Verse Core
2. Définition déclarative `content-campaign` (MVP)
3. Trigger **manual** uniquement
4. Persistence `workflow_runs` (+ lien vers `runs` / `run_steps`)
5. API `GET /workflows` · `POST /workflows/:id/run` · `GET /workflow-runs/:id`
6. UI lancer / suivre (timeline existante)

---

### DT2 — Relation Workflow Engine ↔ Adam / Host

**Proposition (alignée ADR-006 · post-J14) :**

| Mode | Coordinateur |
|------|----------------|
| Chat libre | Agent Adam |
| Workflow déclaratif | **Workflow Engine** (Core) |

- L’Engine **n’est pas** un agent et n’importe pas `agents/*`.
- Il orchestre via **les mêmes** primitives Kernel : `delegate` / `delegateMany` / `ask` (jamais un second bus d’orchestration).
- `delegateMany` reste la **seule** primitive de fan-out.
- `ask` reste consultation ponctuelle (pas d’orch cachée).

---

### DT3 — Forme du graphe MVP `content-campaign`

L’exemple ARCH complet (Nyx, Pulse, HITL schedule) est **trop large** pour P26.

**Proposition MVP :**

```text
brief (adam plan / écrit run.working)
  → fan-out parallel [nova | astra | pixel] via delegateMany
  → aggregate (déterministe, sans polish LLM)
  → completed
```

- Pas de step Pulse / Nyx / social-schedule.
- Pas de `require_approval_before` (HITL = Phase 29).
- Réutilise le golden campagne P24 sous forme déclarative.

**Alternative :** graphe séquentiel Nova → Astra → Pixel (plus simple, moins fidèle au fan-out).  
**Recommandation :** fan-out parallèle (ci-dessus).

---

### DT4 — Format de définition

**Proposition :**

- Fichier versionné sous `workflows/content-campaign/` (manifeste + `definition.json` ou YAML)
- Contrats TypeScript `WorkflowDefinition` / `WorkflowStepSpec` dans `@at72-verse/contracts`
- Install via Package Registry (`kind: workflow`) **optionnel en P26** — peut rester first-party seed comme les agents (aligné P22)

**Recommandation :** seed first-party + registre packages `kind: workflow` minimal ; marketplace UI hors scope.

---

### DT5 — Persistence

**Proposition :**

| Table | Rôle |
|-------|------|
| `workflow_definitions` | Catalogue (id, version, json figé) |
| `workflow_runs` | Instance : status, current_step_ids, definition_snapshot, error, liens org/workspace |
| `runs` / `run_steps` | Exécution agents (existant) — **1 workflow_run → 1 run** (ou N runs enfants) |

**Recommandation :** `1 workflow_run` crée **1** `Run` plateforme ; les steps workflow se matérialisent en `RunStep` (kinds `workflow` / `agent`) pour réutiliser Timeline + projector bus.

Snapshots figés au start : `packages_snapshot` · `grants_snapshot` · `budget_snapshot` · **`definition_snapshot`**.

---

### DT6 — Crash / resume

Critère ROADMAP : *crash mid-step → resume ou fail explicite*.

**Proposition MVP :**

- Status : `queued` → `running` → `completed` | `failed` | `paused` (resume)
- Checkpoint : après chaque step workflow réussi, persister `cursor` / `completed_step_ids`
- Reprise : `POST /workflow-runs/:id/resume` reprend au prochain step non terminé
- Pas de compensation / saga / retry auto (hors scope)

Si reprise trop coûteuse : **fail explicite** + message clair, resume en P26b.

**Recommandation :** checkpoint + resume manuel simple.

---

### DT7 — Triggers

**Proposition P26 :** `manual` uniquement (API + UI).

Hors scope : `schedule` · `webhook` · `event` bus (phases ultérieures).

---

### DT8 — UI

**Proposition :**

- Page `/workflows` : liste définitions installées / first-party
- Action « Lancer » → goal / brief input → crée `workflow_run`
- Suivi : réutiliser Timeline + SSE run existants (pas d’éditeur graphique — post-J14 DR9)

---

### DT9 — Qui exécute les steps agents ?

**Proposition :** Runtime existant + OrchestrationHost.

- Engine appelle Kernel (host Core) → `delegate` / `delegateMany` comme Adam
- Même bus `verse.agent.*.tasks` / events
- API reste sole mutator des `Run` / `RunStep` via projector

Pas de second runtime workflow.

---

### DT10 — Package Registry

**Proposition :**

- Ajouter `kind: "workflow"` au modèle catalogue (seed `pkg.content-campaign`)
- Gate install via `packages_snapshot` si on exécute un workflow installable
- Soft uninstall = ne plus pouvoir **lancer** de nouveaux runs ; runs en cours non cascade-delete

---

### DT11 — Reproductibilité

**Proposition :**

- `definition_snapshot` + snapshots capacités figés au start
- Rejeu avec mêmes snapshots → même structure de steps / fan-out (ordre `targets` déterministe)
- Pas de polish LLM sur l’agrégat (comme DR3)

---

### DT12 — Hors scope (rappel)

| Hors scope P26 | Phase attendue |
|----------------|----------------|
| HITL / approval inbox | P29 |
| Schedule / webhook triggers | plus tard |
| Nyx, Pulse, Echo… dans le graphe | P27+ |
| Éditeur graphique de workflow | — |
| Compensation / retries auto | — |
| Marketplace workflow publique | — |
| Accès direct pgvector / bypass Kernel | interdit (post-J15) |

---

## Contraintes héritées

**Post-J14**
- `delegateMany` = fan-out unique
- `ask` ≠ orchestration
- Host générique
- Snapshots = reproductibilité

**Post-J15**
- Sémantique via `Kernel.memory` only
- Kill-switch textuel
- Embeddings dérivés
- Pas d’accès métier à pgvector

---

## Critères de validation (si pack accepté)

1. Lancer `content-campaign` depuis l’UI / API avec un brief
2. Fan-out Nova+Astra+Pixel visible en Timeline (siblings)
3. Agrégat déterministe ; all-or-nothing si un specialist échoue
4. Crash simulé mid-step → resume **ou** fail explicite documenté
5. Même bus / Kernel que le chat (preuve test)
6. `definition_snapshot` présent sur `workflow_run`
7. Workflow non installé (si gate) → refus propre
