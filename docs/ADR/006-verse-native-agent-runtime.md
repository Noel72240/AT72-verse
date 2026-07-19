# ADR-006 — Runtime d’agents Verse natif (sans framework externe)

- **Status:** Accepted
- **Date:** 2026-07-18
- **Deciders:** Product / Architecture (validation explicite)
- **Option retenue:** C — Runtime Verse custom + Workflow Engine pour les DAG ; interfaces d’extension
- **Dépendances:** ADR-001 à ADR-005

## Context

Le Agent Runtime doit exécuter Adam, Nova et les agents suivants en respectant Kernel, Persona, Skills, Bus et Cost Engine.  
Adopter un framework tiers (LangGraph, etc.) risquerait de contourner ces fondations.  
Il faut un runtime **maison**, borné, extensible par interfaces.

## Decision

### 1. Runtime Verse natif

AT72 Verse possède son **propre Runtime d’agents** (`apps/agent-runtime` + contrats associés).

- **Aucune** dépendance à un framework d’agents externe au MVP (LangGraph, LangChain Agents, CrewAI, AutoGen, OpenAI Agents SDK, etc.).
- Toute I/O externe des agents passe **exclusivement** par le **Verse Kernel** (ADR-002).

### 2. Boucle d’agent simple

Les agents sont des boucles d’exécution relativement simples :

**Reason → Plan → Act → Observe → Reflect**

Ils ne construisent **jamais** leurs propres graphes d’exécution internes.

### 3. Séparation Orchestration / Agent

| Responsabilité | Owner |
|----------------|--------|
| Boucle agent simple | Agent Runtime |
| Orchestration complexe, DAG métier, workflows | **Workflow Engine** (Verse Core) |
| Collaboration inter-agents | **Bus** (ADR-003) + Workflows (+ délégation via Kernel/Adam) |

Les agents **ne collaborent pas** en peer-to-peer direct hors Bus / Workflows / Kernel orchestration.

### 4. Skills

Les Skills restent :

- petites unités spécialisées ;
- **réutilisables** ;
- **stateless** (état = mémoire/run via Kernel, pas d’état caché dans la skill).

### 5. Interfaces d’extension (obligatoires)

Le Runtime est conçu autour d’interfaces remplaçables **sans** modifier le comportement des packages agents :

| Interface | Rôle |
|-----------|------|
| `AgentExecutor` | Orchestre la boucle Reason→…→Reflect pour un agent |
| `Planner` | Produit un plan d’actions borné (pas un DAG workflow) |
| `SkillResolver` | Résout et prépare l’invocation des skills |
| `ToolExecutor` | Délègue l’exécution tools via Kernel (pas d’appel direct) |
| `MemoryResolver` | Accès mémoire via Kernel uniquement |
| `Evaluator` | Evals / scoring / garde-fous qualité |

Implémentations swappables (tests, futures optimisations, éventuel backend alternatif).

### 6. Capacités natives du Runtime

First-class, non optionnelles :

- **evals** ;
- **traces** (OpenTelemetry / correlation `run_id`) ;
- **métriques** ;
- **coûts** (via Cost Engine / ledger, dont `credential_source` ADR-005) ;
- **événements** (via API Bus, ADR-003).

### 7. Évolution future (LangGraph, etc.)

Si un besoin futur justifie LangGraph ou un autre framework, il devra être **encapsulé exclusivement** derrière `AgentExecutor` (ou une implémentation de cette interface), **sans impacter** le code des agents / skills existants.

Ce n’est **pas** le chemin par défaut ; un ADR dédié sera requis avant introduction.

### 8. Non-goals

- Mini-workflow engine dans chaque agent.
- Tools/memory du framework tiers.
- Communication HTTP directe agent→agent.

## Consequences

### Positive

- Alignement total avec ADR-001→005 et ARCHITECTURE V2.
- Frontière claire agent loop vs Workflow Engine.
- Testabilité élevée via interfaces.
- Remplacement futur d’implémentations sans big-bang agents.

### Negative

- Il faut implémenter/maintenir la boucle et les interfaces (effort Runtime Phases 12–15).
- Moins de « magie » out-of-the-box qu’un framework marché.
- Discipline CI contre imports de frameworks agents.

### Neutral

- Les workflows déclaratifs (`workflows/*`) portent la complexité DAG.
- Adam reste un agent orchestrateur **utilisateur** de Core/Bus, pas un framework.

## Alternatives considered

| Option | Résumé | Motif du rejet |
|--------|--------|----------------|
| **A** — Custom pur sans clarifier workflows | Proche | Risque de DAG cachés dans les agents |
| **B** — LangGraph.js par défaut | Graphes matures | Conflit Kernel/Persona/Skill/Bus |
| **D** — Autre framework multi-agent | DX rapide | Encore plus de collision architecturale |

## Enforcement

- `agents/**` et `skills/**` : interdiction d’importer LangGraph/LangChain/CrewAI/etc.
- I/O uniquement via Kernel.
- Revue : aucun graphe d’exécution maison dans un package agent.
- Runtime expose et utilise les interfaces listées ; agents enregistrés contre ces ports.
