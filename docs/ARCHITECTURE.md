# AT72 Verse — Document d’Architecture Logicielle

**Version :** 2.0  
**Statut :** Conception (pré-implémentation)  
**Date :** 18 juillet 2026  
**Audience :** Fondateurs, leads techniques, contributeurs futurs  
**Évolution :** V1.0 (architecture initiale) → **V2.0** (Verse Core, Verse Kernel, Persona Engine, Skill Engine, Marketplace Foundations)

### Changelog V2.0

| Ajout | Description |
|-------|-------------|
| **Verse Core** | Cœur technique de la plateforme (pas un agent) |
| **Verse Kernel** | Noyau d’abstraction : seuls point d’accès infra pour les agents |
| **Persona Engine** | Identité agent 100 % configurable hors code |
| **Skill Engine** | Compétences réutilisables, découplées des agents |
| **Marketplace Foundations** | Seams pour marketplaces Agents / Skills / Tools / Workflows / Prompts |
| **Adam recalibré** | Premier agent orchestrateur *utilisant* Verse Core, non le cœur lui-même |

Tout le contenu V1 (stack, agents, bus, DB, mémoire, permissions, tools, LLM, workflows, API, multi-tenancy, obs., phases) est **conservé et réaligné** sur ces fondations.

---

## Table des matières

1. [Vision produit](#1-vision-produit)
2. [Principes d’architecture](#2-principes-darchitecture)
3. [Stack technologique recommandée](#3-stack-technologique-recommandée)
4. [Vue d’ensemble système](#4-vue-densemble-système)
5. [Verse Core](#5-verse-core)
6. [Verse Kernel](#6-verse-kernel)
7. [Persona Engine](#7-persona-engine)
8. [Skill Engine](#8-skill-engine)
9. [Marketplace Foundations](#9-marketplace-foundations)
10. [Arborescence monorepo](#10-arborescence-monorepo)
11. [Architecture frontend](#11-architecture-frontend)
12. [Architecture backend](#12-architecture-backend)
13. [Organisation des agents](#13-organisation-des-agents)
14. [Système de communication inter-agents](#14-système-de-communication-inter-agents)
15. [Base de données](#15-base-de-données)
16. [Système mémoire](#16-système-mémoire)
17. [Système de permissions](#17-système-de-permissions)
18. [Outils (Tools)](#18-outils-tools)
19. [Providers LLM](#19-providers-llm)
20. [Workflows](#20-workflows)
21. [API](#21-api)
22. [Modules futurs](#22-modules-futurs)
23. [Multi-tenancy & isolation](#23-multi-tenancy--isolation)
24. [Observabilité, sécurité & résilience](#24-observabilité-sécurité--résilience)
25. [Stratégie d’évolution & phases](#25-stratégie-dévolution--phases)
26. [Décisions ouvertes (ADR backlog)](#26-décisions-ouvertes-adr-backlog)

---

## 1. Vision produit

### 1.1 Qu’est-ce qu’AT72 Verse ?

AT72 Verse est une **plateforme SaaS multi-agents** destinée aux entreprises. Elle ne se limite pas à un chatbot conversationnel : elle expose un **écosystème d’agents spécialisés** capables de collaborer, déléguer, partager une mémoire organisationnelle, et exécuter des workflows métier de bout en bout.

Au centre de la plateforme ne se trouve **pas** un agent, mais deux fondations techniques :

- **Verse Core** — le cœur métier/technique de la plateforme ;
- **Verse Kernel** — le noyau d’abstraction vers toute l’infrastructure.

Les agents (Adam, Nova, Orion…) sont des **plugins** qui s’exécutent *au-dessus* de ces fondations.

### 1.2 Rôle d’Adam (V2)

**Adam** est le **premier agent orchestrateur** de la plateforme. Il :

- comprend l’intention utilisateur ;
- planifie la décomposition de la tâche ;
- sélectionne et délègue aux agents spécialisés (via Verse Core) ;
- agrège les résultats ;
- arbitre les conflits et les priorités ;
- **ne réalise pas lui-même** les tâches métier spécialisées ;
- **n’est pas** le cœur technique de la plateforme.

Adam **utilise Verse Core** (orchestration, routing, politiques, coûts, profils IA) **exclusivement via le Verse Kernel**, comme tout autre agent.

> **V1 → V2 :** ce qui était nommé « Adam Core / Orchestrator service » devient la responsabilité de **Verse Core**. Adam n’est plus le système d’orchestration : il en est le premier *consommateur intelligent*.

### 1.3 Catalogue initial d’agents

| Agent   | Rôle                         | Domaine                         |
|---------|------------------------------|---------------------------------|
| Adam    | Orchestrateur (agent)        | Planification, délégation       |
| Nova    | Création de contenu          | Rédaction, copywriting          |
| Orion   | Analyse                      | Data, insights, reporting       |
| Pixel   | Design                       | Visuels, brand assets           |
| Nyx     | Vidéo                        | Scripts, storyboards, vidéo     |
| Astra   | SEO                          | Audit, contenu SEO, technique   |
| Pulse   | Réseaux sociaux              | Planning, posts, engagement     |
| Echo    | Google Business              | Fiches, avis, local             |
| Nexus   | Automatisations              | Intégrations, triggers, jobs    |
| Vega    | Veille stratégique           | Monitoring, intelligence        |
| Neo     | Commercial                   | Pipeline, offres, CRM           |
| Kira    | Support client               | Tickets, FAQ, conversationnel   |

L’architecture doit permettre d’ajouter des dizaines, puis des **centaines** d’agents sans refactorisation structurelle — via registry, personas, skills, tools et marketplaces.

### 1.4 Modèle mental des briques (V2)

```
┌─────────────────────────────────────────────────────────────┐
│                         AGENTS                               │
│         Adam · Nova · Orion · … · (marketplace)              │
│   (Persona + Skills attachées + Tools autorisés)             │
└───────────────────────────┬─────────────────────────────────┘
                            │ appels Kernel uniquement
┌───────────────────────────▼─────────────────────────────────┐
│                      VERSE KERNEL                            │
│         API unifiée / « syscalls » plateforme                │
└───────────────────────────┬─────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────┐
│                       VERSE CORE                             │
│  Orchestration · LLM · Mémoire · Permissions · Routing       │
│  Events · Security Policies · Coûts · Profils IA             │
│  Persona Engine · Skill Engine · Tool Runtime · Workflows    │
└───────────────────────────┬─────────────────────────────────┘
                            │ adapters
┌───────────────────────────▼─────────────────────────────────┐
│     PostgreSQL · Redis · Vector · S3 · NATS · Providers LLM  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Principes d’architecture

### 2.1 Principes directeurs

1. **Agent-as-a-Plugin** — Chaque agent est un module versionné, découvrable, isolé, déployable indépendamment à terme.
2. **Core ≠ Agent** — Verse Core n’est jamais un agent ; Adam et les futurs orchestrateurs sont des agents au-dessus du Core.
3. **Kernel-mediated I/O** — Aucun agent ne parle directement à PostgreSQL, Redis, un provider LLM, le storage ou un API externe. **Tout passe par le Verse Kernel.**
4. **Configuration over code** — Personnalité, ton, style, règles, mémoire, outils, skills et modèles sont configurables (Persona / Skills / Profiles) sans modifier le code agent.
5. **Skill reuse** — La logique métier réutilisable vit dans des **Skills**, pas dans le code dur d’un agent.
6. **Orchestration explicite** — Aucun agent métier ne s’auto-proclame chef ; Adam (ou un workflow déclaré) pilote via Verse Core.
7. **Contrats avant implémentation** — Interfaces stables : `AgentManifest`, `PersonaSpec`, `SkillSpec`, `ToolSpec`, `PromptPack`, `BusMessage` (enveloppe ADR-003), `MemoryRecord`, `PermissionGrant`, `PackageManifest` (marketplace).
8. **Event-driven au cœur** — La collaboration repose sur un bus d’événements / messages, pas sur des appels synchrones en cascade.
9. **Multi-tenant by design** — Isolation stricte par organisation (`tenant_id`) à tous les niveaux.
10. **Capability-based security** — Les agents n’ont accès qu’aux skills, tools et mémoires explicitement autorisés.
11. **Provider-agnostic LLM** — Aucun couplage dur à un fournisseur de modèle.
12. **Marketplace-ready** — Toute brique installable (agent, skill, tool, workflow, prompt) suit le même cycle : manifeste → signature → registry → enablement tenant.
13. **Observabilité first-class** — Chaque délégation, skill, tool call et décision est traçable.
14. **Évolutivité horizontale** — API, Kernel/Core, workers agents et stores sont scalables indépendamment.
15. **Fail soft** — Un agent / skill / tool défaillant ne doit pas faire tomber la plateforme ; compensation / retry / fallback.

### 2.2 Anti-patterns à éviter

- Monolithe conversationnel où tout passe par un seul prompt géant.
- Agents codés en dur dans le frontend.
- **Agents qui importent Prisma, Redis clients, ou SDK OpenAI directement.**
- Personnalité / ton / règles hardcodés dans le code source de l’agent.
- Logique métier dupliquée dans plusieurs agents au lieu d’une Skill partagée.
- Stockage mémoire uniquement dans le contexte LLM.
- Permissions uniquement au niveau utilisateur UI (ignorer agent/tool/skill).
- Couplage synchrone agent → agent via HTTP direct sans bus / Kernel.
- Schéma DB agent-spécifique non versionné dans le core.
- Marketplace collée en afterthought (URLs spéciales, schéma parallèle).

---

## 3. Stack technologique recommandée

Choix orientés **2026**, maturité, écosystème TypeScript unifié, et scalabilité SaaS.

| Couche              | Technologie                              | Justification |
|---------------------|------------------------------------------|---------------|
| Monorepo            | **pnpm + Turborepo**                     | Workspaces rapides, pipelines de build |
| Langage             | **TypeScript** (strict)                  | Contrats partagés front/back/agents |
| Frontend            | **Next.js 15** (App Router)              | SSR/RSC, SEO marketing, app SaaS |
| UI                  | **Tailwind CSS + shadcn/ui**             | Design system rapide et cohérent |
| State client        | **TanStack Query + Zustand**             | Serveur state + UI state léger |
| API Gateway         | **NestJS**                               | Modularité, DI, guards, OpenAPI |
| Verse Core / Kernel | **Package(s) Nest + runtime Node**       | Cœur partagé, API Kernel stable |
| Runtime agents      | **Agent Runtime Verse natif (ADR-006)** — pas de framework agents externe au MVP | Boucle simple ; DAG = Workflow Engine |
| Files d’attente     | **BullMQ + Redis**                       | Jobs asynchrones, retries, DLQ |
| Event bus           | **Redis Streams (MVP — ADR-003)** derrière API Bus générique → **NATS JetStream** (cible) | Pub/sub durable ; code métier opaque au transport |
| ORM / SQL           | **PostgreSQL + Prisma**                  | Relationnel multi-tenant robuste |
| Vector store        | **pgvector** (MVP) → **Qdrant** (échelle) | Mémoire sémantique |
| Object storage      | **S3-compatible** (R2 / S3 / MinIO)      | Assets, exports, médias |
| Auth                | **Clerk (IdP — ADR-004)** derrière `packages/auth` ; domaine/RBAC = Verse DB only | Identité ≠ métier ; IdP remplaçable |
| Realtime            | **WebSocket (Nest) + SSE**               | Streams de pensées / progression |
| Cache               | **Redis**                                | Sessions, rate limits, hot memory |
| Search (optionnel)  | **OpenSearch / Meilisearch**             | Recherche workspace / marketplace |
| Observabilité       | **OpenTelemetry + Grafana stack**        | Traces, metrics, logs |
| IaC                 | **Terraform / Pulumi**                   | Infra reproductible |
| Conteneurs          | **Docker + Kubernetes** (prod)           | Scale workers/agents |
| CI/CD               | **GitHub Actions**                       | Tests, builds, déploiements |

### 3.1 Pourquoi cette stack ?

- **Un seul langage** (TS) réduit le coût cognitif entre UI, API, Kernel, Core, agents et skills.
- **NestJS** structure naturellement domaines, permissions et modules SaaS.
- **BullMQ + NATS** séparent clairement *jobs de travail* et *événements de collaboration*.
- **PostgreSQL + pgvector** minimise le nombre de stores au MVP tout en restant scalable.
- **Next.js** couvre marketing, dashboard, console agents et docs dans un seul front.
- **Kernel as package + service boundary** permet de durcir ensuite l’isolation (process/network) sans changer les contrats agents.

### 3.2 Alternative acceptée (si équipe Python forte côté agents)

Conserver le front/API/Core en TypeScript, et isoler le **Agent Runtime** en Python. Dans ce cas, le **Verse Kernel** expose une API RPC/gRPC/HTTP versionnée : les agents Python n’ont **aucun** accès infra direct. **Recommandation initiale : full TypeScript** pour homogénéité.

---

## 4. Vue d’ensemble système

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         Clients (Web / API / Webhooks)                   │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼──────────────────────────────────────┐
│                     Edge / CDN / WAF / Rate limiting                     │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼──────────────────────────────────────┐
│              Frontend (Next.js)  — App SaaS + Console Agents             │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    │ HTTPS / WSS
┌───────────────────────────────────▼──────────────────────────────────────┐
│                         API Gateway (NestJS)                             │
│  Auth · Tenancy · RBAC · Quotas · OpenAPI · Webhooks inbound             │
│  Domain Services (workspaces, billing, marketplace catalog…)             │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼──────────────────────────────────────┐
│                         VERSE KERNEL (façade)                            │
│  Seul point d’entrée pour agents / skills / runtimes                     │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼──────────────────────────────────────┐
│                           VERSE CORE                                     │
│  Orchestration Engine · Router · Event Bus control                       │
│  LLM Provider Manager · Model Profiles · Cost Engine                     │
│  Memory Gateway · Permission / Policy Engine                             │
│  Persona Engine · Skill Engine · Tool Runtime · Workflow Engine          │
└───────────────┬─────────────────────────────┬────────────────────────────┘
                │                             │
                │                     ┌───────▼────────┐
                │                     │  Message Bus   │
                │                     │ NATS / Redis   │
                │                     └───────┬────────┘
                │                             │
┌───────────────▼──────────────┐    ┌─────────▼────────────────────────────┐
│   Infra Adapters (Core)      │    │     Agent Runtime Workers            │
│  PG · Redis · Vector · S3    │    │  Adam · Nova · Orion · … · Kira      │
│  Secrets · LLM SDKs          │    │  (plugins ; Kernel client only)      │
└──────────────────────────────┘    └──────────────────────────────────────┘
```

### 4.1 Flux nominal (requête utilisateur)

1. L’utilisateur envoie un message dans un workspace.
2. L’API authentifie, résout le tenant, vérifie quotas et permissions.
3. Une **Conversation Run** est créée ; le message est persisté (via services domaine → Core/adapters).
4. Verse Core émet / route `run.requested` ; **Adam** (agent orchestrateur) est invoqué via le bus.
5. Adam appelle le Kernel (`orchestration.plan`, `routing.resolve`, `llm.complete` avec profil `orchestrate-precise`).
6. Verse Core produit un plan : intention → sous-tâches → agents → skills → tools.
7. Des **Task Messages** sont publiés vers les agents concernés.
8. Chaque agent charge sa **Persona**, résout ses **Skills**, exécute via le Kernel (mémoire, LLM, tools).
9. Les résultats remontent (`task.completed` / `task.failed`) ; Adam synthétise (encore via Kernel).
10. Le frontend reçoit le stream (tokens, steps, artefacts, coûts) en temps réel.

### 4.2 Règle d’or d’accès

| Acteur | Peut accéder à… | Interdit |
|--------|-----------------|----------|
| Agent / Skill code | Client Kernel uniquement | PG, Redis, OpenAI SDK, S3, NATS brut |
| Verse Kernel | Verse Core APIs | Contournement des policies |
| Verse Core | Adapters infra | Logique métier agent-spécifique |
| API Gateway | Domain services + Core (admin paths) | Exposer les adapters aux agents |

---

## 5. Verse Core

### 5.1 Définition

**Verse Core** est le **cœur technique** d’AT72 Verse.  
Ce n’est **pas** un agent. Ce n’est **pas** Adam.

Il regroupe les services plateforme transverses dont dépendent tous les agents, skills, tools et workflows.

### 5.2 Responsabilités

| Domaine | Responsabilité Core |
|---------|---------------------|
| **Orchestration globale** | Moteur de planification, scheduling de runs/steps, fan-out/fan-in, compensation, HITL hooks |
| **Providers LLM** | Enregistrement, santé, fallback, BYOK, quotas provider |
| **Mémoire** | Memory Gateway (L0–L5), compaction, rétention, recall |
| **Permissions** | Evaluation des grants (user, agent, skill, tool, memory) |
| **Routage** | Capability / skill matching, sélection d’agents, priorités |
| **Événements** | Publication contrôlée, schémas d’événements, corrélation |
| **Politiques de sécurité** | PII, allowlists, sandbox, prompt-injection defenses, data residency |
| **Coûts** | Cost Engine : estimation, budget run/tenant, metering, alertes |
| **Profils IA** | Model Profiles & routing `profile → provider/model` |
| **Persona Engine** | Résolution & composition des personas (voir §7) |
| **Skill Engine** | Résolution, exécution et composition des skills (voir §8) |
| **Tool Runtime** | Exécution tools via connecteurs (voir §18) |
| **Workflow Engine** | Interprétation des graphes déclaratifs (voir §20) |
| **Package Registry** | Catalogue installable (fondation marketplace, §9) |

### 5.3 Ce que Verse Core n’est pas

- Pas un chatbot.
- Pas un agent « super-Adam ».
- Pas un endroit pour coller la logique métier de Nova/Pixel/…
- Pas un accès libre à l’infra pour les apps clientes (l’API Gateway reste le front door humain/SDK).

### 5.4 Sous-systèmes Core (modules logiques)

```
verse-core/
├── orchestration/          # Run planner, step scheduler, aggregators
├── routing/                # Intent → agents/skills
├── events/                 # Event schemas, emit/subscribe policies
├── llm/                    # Provider manager + model router
├── profiles/               # AI Model Profiles
├── memory/                 # Memory Gateway
├── permissions/            # Policy evaluation
├── security/               # Security policies, redaction, sandbox rules
├── cost/                   # Budgets, metering, estimates
├── persona/                # Persona Engine
├── skills/                 # Skill Engine
├── tools/                  # Tool runtime orchestration
├── workflows/              # Workflow engine
├── registry/               # Packages (agents, skills, tools, workflows, prompts)
└── adapters/               # PG, Redis, Vector, S3, Bus, Vault, LLM SDKs
```

### 5.5 Relation Adam ↔ Verse Core

```
User → API → Run créé
              ↓
         Verse Core (orchestration engine) assigne le run à Adam
              ↓
         Adam (agent) raisonne avec sa Persona + Skills d’orchestration
              ↓
         Adam demande au Kernel : plan, route, delegate, llm, memory…
              ↓
         Verse Core exécute ces demandes (policies + adapters)
              ↓
         Autres agents reçoivent des tasks
```

On peut demain introduire un second orchestrateur (ex. « Adam Light », « Eve ») **sans dupliquer** le moteur d’orchestration : ce sont de nouveaux agents `kind: orchestrator` branchés sur le même Core.

---

## 6. Verse Kernel

### 6.1 Définition

Le **Verse Kernel** est le **noyau** de la plateforme : la **seule interface autorisée** entre le monde des agents/skills et le monde de l’infrastructure / Verse Core.

Analogie : comme un OS kernel — les processus (agents) font des *syscalls* ; ils n’accèdent pas au matériel (Postgres, Redis, OpenAI…) directement.

### 6.2 Règle absolue

> **Aucun agent ne communique directement avec PostgreSQL, Redis, OpenAI (ou autre LLM), S3, NATS, Vault, ou un service HTTP externe.**  
> Toute communication passe par le **Verse Kernel**.

Cette règle s’applique aussi aux **Skills** et aux **handlers** d’agents.

### 6.3 Surface Kernel (syscalls conceptuels)

| Famille | Exemples d’appels |
|---------|-------------------|
| `llm.*` | `complete`, `stream`, `embed` |
| `memory.*` | `remember`, `recall`, `summarize`, `forget`, `pin`, `link` |
| `tools.*` | `execute`, `list_available` |
| `skills.*` | `invoke`, `resolve` |
| `persona.*` | `resolve` (lecture composée pour le run) |
| `orchestration.*` | `delegate`, `ask`, `complete_task`, `request_hitl` |
| `events.*` | `emit`, `subscribe` (scopes limités) |
| `artifacts.*` | `write`, `read`, `list` |
| `cost.*` | `estimate`, `get_budget`, `report_usage` (indirect) |
| `registry.*` | `get_agent`, `get_skill`, `get_tool` (lecture) |
| `files.*` | `upload`, `download` (via object storage adapter) |

Chaque appel Kernel :

1. authentifie le principal (agent/run/user) ;
2. évalue les permissions (Core Policy Engine) ;
3. applique les security policies ;
4. vérifie le budget / quotas (Cost Engine) ;
5. délègue à Verse Core ;
6. journalise audit + traces ;
7. retourne un résultat typé / erreur normalisée.

### 6.4 Isolation & déploiement

| Mode | Description | Quand |
|------|-------------|-------|
| **Library Kernel + transport pluggable** | Package TS (`packages/verse-kernel`) ; transport choisi par le Kernel (in-process depuis `api`, réseau interne depuis `agent-runtime`) | **MVP — ADR-002 Accepted** |
| **Sidecar / RPC Kernel** | Processus Kernel dédié | Durcissement sécurité (futur, même API publique) |
| **Multi-tenant Kernel gateway** | Gateway partagée avec quotas stricts | Échelle enterprise |

**Règle d’opacité (ADR-002) :** agents et skills ne connaissent **jamais** le transport (in-process, HTTP, gRPC…). Ils n’utilisent que l’API publique du Kernel. Toute évolution d’infra se fait sans modifier leur code.

Le **contrat** Kernel reste identique quel que soit le mode.

### 6.5 Ce que le Kernel refuse

- Requêtes SQL brutes
- Accès Redis arbitrary keys
- Appels LLM avec modèle hardcodé hors profil autorisé
- Tool side-effect sans permission / sans HITL si requis
- Émission d’événements hors schéma / hors scope run
- Lecture mémoire hors scopes accordés

### 6.6 Client Kernel pour agents

Chaque agent runtime reçoit un `KernelClient` injecté (scoped au `run_id` + `agent_id` + grants snapshot).  
C’est le **seul** dependency d’I/O autorisé dans `agents/*` et `skills/*`.  
Aucun agent/skill ne configure ni ne détecte le transport sous-jacent.

---

## 7. Persona Engine

### 7.1 Objectif

Chaque agent possède une **identité complètement configurable**, séparée du code.  
Modifier le ton, les règles ou le modèle **ne nécessite pas** de redeploy du package agent (sauf changement de skills/tools nouveaux).

### 7.2 Dimensions séparées

| Dimension | Contenu | Exemples |
|-----------|---------|----------|
| **Personnalité** | Traits, posture, valeurs | Empathique, direct, pédagogique |
| **Ton** | Registre linguistique | Tutoiement, premium, corporate |
| **Style** | Forme des sorties | Court, structuré, storytelling |
| **Règles** | Interdits / obligations | « Ne jamais inventer de chiffres », « Toujours citer sources » |
| **Mémoire** | Scopes & politiques mémoire liés à l’identité | `org.brand`, `agent.nova.preferences` |
| **Outils** | Tools autorisés (réfs) | `cms-publish`, `web-search` |
| **Compétences** | Skills attachées (réfs) | `skill.writing`, `skill.seo` |
| **Modèles IA** | Profile(s) LLM préférés / overrides | `creative-balanced` |

### 7.3 PersonaSpec (contrat)

```text
PersonaSpec {
  id: "persona.nova.default"
  version: "3.1.0"
  agent_id: "nova"                    # ou null si persona portable
  personality: { traits: [...], bio: "..." }
  tone: { formality, language, voice }
  style: { structure, length, formatting }
  rules: [
    { id, severity: "must"|"should"|"must_not", text }
  ]
  memory: {
    read_scopes: [...],
    write_scopes: [...],
    pin_policy: "..."
  }
  tools: ["web-search", "file-write", "cms-publish"]
  skills: ["skill.writing", "skill.translation"]
  model_profiles: {
    default: "creative-balanced",
    overrides: { "longform": "long-context" }
  }
  locale: "fr-FR"
  safety_profile: "standard" | "strict"
}
```

### 7.4 Couches de résolution (merge)

Ordre de composition (du plus générique au plus spécifique) :

1. Persona **système** (plateforme)
2. Persona **agent** (default first-party)
3. Overrides **organization**
4. Overrides **workspace**
5. Overrides **user** (si autorisé)
6. Overrides **run** (brief temporaire Adam)

Le Persona Engine produit une **ResolvedPersona** immuable pour la durée du step/run.

### 7.5 Séparation code agent / persona

Le package agent contient :

- handlers minimes / wiring ;
- déclarations de skills *supportées* ;
- evals.

Il **ne contient pas** (ou plus comme source de vérité) :

- le texte de personnalité ;
- le ton ;
- les règles business configurables ;
- le mapping modèle.

Ces éléments vivent dans le **Persona Engine** (+ packs prompts marketplace éventuels).

### 7.6 UI Console

L’Agent Console expose des éditeurs par dimension (personnalité, ton, style, règles, skills, tools, modèles) avec preview et versioning.

---

## 8. Skill Engine

### 8.1 Objectif

Dissocier les **compétences** des agents.  
Une Skill est une unité de capacité **réutilisable**, versionnée, testable, installable.

Les agents **utilisent des Skills** au lieu d’embarquer toute leur logique.

### 8.2 Exemples de Skills

| Skill ID | Description | Agents consommateurs typiques |
|----------|-------------|-------------------------------|
| `skill.writing` | Rédaction, copy, structure éditoriale | Nova, Pulse, Neo, Kira |
| `skill.seo` | Optimisation & audit SEO | Astra, Nova |
| `skill.analysis` | Analyse de données / insights | Orion, Vega, Neo |
| `skill.translation` | Traduction multilingue | Nova, Pulse, Kira |
| `skill.image-generation` | Brief + génération d’image | Pixel, Nova |
| `skill.orchestration` | Planification / délégation | Adam |
| `skill.social-scheduling` | Calendrier & formats social | Pulse |
| `skill.local-presence` | Fiches & avis locaux | Echo |
| `skill.support-triage` | Classification tickets | Kira |
| `skill.crm-assist` | Assistance pipeline | Neo |

### 8.3 Skill vs Tool vs Agent

| Concept | Nature | Réutilisable | Side-effect typique |
|---------|--------|--------------|---------------------|
| **Agent** | Acteur + Persona + ensemble de Skills | Installable | Orchestre / produit |
| **Skill** | Compétence cognitive / procédure | **Oui, multi-agents** | Souvent non (ou via tools) |
| **Tool** | Capacité atomique d’I/O / action | Oui | Souvent oui |
| **Prompt Pack** | Contenu prompt versionné | Oui | Non |

Exemple : `skill.seo` peut appeler le tool `seo-audit` et le tool `web-search`, et être utilisée par Astra **et** Nova.

### 8.4 SkillSpec (contrat)

```text
SkillSpec {
  id: "skill.writing"
  version: "2.4.0"
  name: "Writing"
  description: "..."
  input_schema: JSONSchema
  output_schema: JSONSchema
  required_tools: ["file-write"]       # optionnel
  optional_tools: ["web-search", "cms-publish"]
  default_model_profile: "creative-balanced"
  persona_hints: { prefer_style: "structured" }
  tags: ["content", "copy"]
  eval_suite: "evals/writing-v2"
  permissions: ["skill.invoke:writing"]
}
```

### 8.5 Exécution

```
Agent (Nova)
  → Kernel.skills.invoke("skill.writing", input)
    → Skill Engine (Core)
      → vérifie grant agent↔skill
      → charge Skill + prompts associés
      → Kernel.llm.* / Kernel.tools.* selon besoin
      → retourne output schema-validé
```

Une Skill **n’accède jamais** à l’infra hors Kernel (même règle que les agents).

### 8.6 Composition

- Skills peuvent être **composées** (pipeline) dans un workflow ou par un agent.
- Interdiction des dépendances circulaires skill→skill (détectées au publish registry).
- Versioning sémantique + compatibilité déclarée (`engines.verse_core`).

### 8.7 Structure package Skill

```
skills/writing/
├── skill.manifest.json
├── src/
│   ├── index.ts              # register(skillEngine)
│   ├── prompts/
│   ├── policies.ts
│   └── evals/
├── package.json
└── README.md
```

---

## 9. Marketplace Foundations

### 9.1 Vision

Prévoir **dès maintenant** une architecture permettant d’ajouter ultérieurement, **sans modifier l’architecture principale** :

- Marketplace d’**Agents**
- Marketplace de **Skills**
- Marketplace d’**Outils (Tools)**
- Marketplace de **Workflows**
- Marketplace de **Prompts**

### 9.2 Principe unifié : Package

Toute chose installable est un **Package** :

```text
PackageManifest {
  id: "pkg.nova" | "pkg.skill.writing" | ...
  kind: "agent" | "skill" | "tool" | "workflow" | "prompt_pack"
  version: "1.0.0"
  publisher: "at72" | "third-party:acme"
  display_name, description, icons
  contracts: { min_core: "2.x", min_kernel: "2.x" }
  permissions_requested: [...]
  resources: { entrypoint, manifests[] }
  signature: { alg, digest, cert_chain_ref }
  pricing: { model: "free"|"subscription"|"usage", ... }  # futur
  categories, tags
}
```

### 9.3 Cycle de vie commun

```
Author → Build → Sign → Publish (registry)
  → Discover (marketplace UI/API)
  → Install (tenant)
  → Enable (workspace)
  → Grant permissions
  → Execute via Kernel/Core
  → Update / Rollback / Uninstall
```

### 9.4 Seams architecturaux (à poser dès Phase 0–1)

| Seam | Rôle |
|------|------|
| **Package Registry** | Catalogue versionné first-party + futur third-party |
| **Signature & Trust** | Vérif. d’intégrité avant install |
| **Permission manifest** | Déclaration des droits demandés à l’install |
| **Sandbox policy** | Isolation tools/network pour packages tiers |
| **Install records** | `tenant_packages`, versions pinnées |
| **Discovery API** | Recherche / filtres / catégories (même API pour 5 marketplaces) |
| **Billing hooks** | Usage events déjà émis par Cost Engine |

### 9.5 Cinq marketplaces, un même moteur

| Marketplace | `kind` | Contenu |
|-------------|--------|---------|
| Agents | `agent` | Adam, Nova… + tiers |
| Skills | `skill` | writing, seo, analysis… |
| Tools | `tool` | seo-audit, crm-sync… |
| Workflows | `workflow` | content-campaign… |
| Prompts | `prompt_pack` | packs de prompts versionnés liés personas/skills |

L’UI Marketplace sera multi-onglets ; le **backend reste un registry unique**.

### 9.6 Ce qui ne change pas quand la marketplace arrive

- Contrats Kernel
- Verse Core modules
- Bus / runs / permissions model
- Adapters infra

On ajoute : store de packages, signature, UI discovery, éventuel review/moderation — **pas** un second système d’agents.

---

## 10. Arborescence monorepo

Structure cible recommandée (pnpm workspaces + Turborepo) — **V2** :

```
AT72-Verse/
├── apps/
│   ├── web/                          # Next.js — UI SaaS + marketing + console
│   ├── api/                          # NestJS — API Gateway + domain services
│   ├── verse-core/                   # Service Verse Core (peut être lib+embedded au MVP)
│   ├── agent-runtime/                # Workers d’exécution des agents
│   └── worker/                       # Jobs asynchrones (exports, sync, billing, embeddings)
│
├── packages/
│   ├── config-eslint/
│   ├── config-tsconfig/
│   ├── config-tailwind/
│   ├── ui/                           # Design system partagé
│   ├── sdk/                          # SDK client TypeScript (API publique)
│   ├── contracts/                    # Types & JSON Schemas partagés
│   │   ├── agents/
│   │   ├── personas/
│   │   ├── skills/
│   │   ├── tools/
│   │   ├── prompts/
│   │   ├── messages/
│   │   ├── memory/
│   │   ├── permissions/
│   │   ├── workflows/
│   │   ├── packages/                 # PackageManifest marketplace
│   │   └── kernel/                   # Contrats syscalls Kernel
│   ├── verse-kernel/                 # Client + (optionnel) server Kernel
│   ├── verse-core/                   # Lib Core (si embedded) / shared domain
│   ├── bus/                          # API Bus générique + adapter Redis Streams (ADR-003)
│   ├── db/                           # Prisma schema, migrations, client
│   ├── auth/
│   ├── observability/
│   └── testing/
│
├── agents/                           # Plugins agents (code minimal + wiring)
│   ├── adam/
│   ├── nova/
│   ├── orion/
│   ├── pixel/
│   ├── nyx/
│   ├── astra/
│   ├── pulse/
│   ├── echo/
│   ├── nexus/
│   ├── vega/
│   ├── neo/
│   ├── kira/
│   └── _template/
│
├── personas/                         # Personas versionnées (config, pas code lourd)
│   ├── adam.default/
│   ├── nova.default/
│   └── _template/
│
├── skills/                           # Skills réutilisables
│   ├── writing/
│   ├── seo/
│   ├── analysis/
│   ├── translation/
│   ├── image-generation/
│   ├── orchestration/
│   └── _template/
│
├── tools/                            # Tools métier versionnés
│   ├── web-search/
│   ├── http-request/
│   ├── file-read-write/
│   ├── image-generate/
│   ├── cms-publish/
│   ├── seo-audit/
│   ├── social-publish/
│   ├── gmb-sync/
│   ├── crm-sync/
│   └── _template/
│
├── prompts/                          # Prompt packs versionnés
│   ├── writing.core/
│   ├── seo.audit/
│   └── _template/
│
├── workflows/                        # Définitions de workflows déclaratifs
│   ├── content-campaign/
│   ├── local-seo-boost/
│   ├── support-triage/
│   └── _template/
│
├── infra/
│   ├── docker/
│   ├── k8s/
│   ├── terraform/
│   └── monitoring/
│
├── docs/
│   ├── ARCHITECTURE.md               # Ce document
│   ├── ADR/
│   ├── agents/
│   ├── skills/
│   ├── api/
│   └── runbooks/
│
├── scripts/
│   ├── scaffold-agent.ts
│   ├── scaffold-skill.ts
│   ├── scaffold-tool.ts
│   ├── scaffold-persona.ts
│   ├── scaffold-prompt-pack.ts
│   └── seed-dev.ts
│
├── .github/workflows/
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

### 10.1 Règles d’organisation

- **`apps/*`** : déployables.
- **`packages/verse-kernel`** : seule dépendance I/O autorisée pour agents & skills.
- **`packages/verse-core` / `apps/verse-core`** : logique plateforme ; adapters infra ici uniquement.
- **`agents/*`** : wiring + handlers minimes ; **pas** d’accès infra ; personas/skills en réfs.
- **`skills/*`** : compétences réutilisables ; Kernel only.
- **`personas/*` / `prompts/*`** : configuration versionnée.
- **`tools/*`** : I/O atomique ; exécutés par le Tool Runtime du Core.
- **`workflows/*`** : orchestrations déclaratives.
- **Aucun import** `agents → db | redis | llm-sdk | prisma`.
- **Aucun import circulaire** `agents → apps`.

---

## 11. Architecture frontend

### 11.1 Application `apps/web`

Structure App Router proposée :

```
apps/web/src/
├── app/
│   ├── (marketing)/                  # Landing, pricing, docs publiques
│   ├── (auth)/                       # Login, signup, SSO callback
│   ├── (app)/                        # Zone authentifiée
│   │   ├── layout.tsx
│   │   ├── dashboard/
│   │   ├── workspaces/[workspaceId]/
│   │   │   ├── chat/                 # Conversation avec Adam
│   │   │   ├── agents/               # Catalogue, personas, skills attachées
│   │   │   ├── skills/               # Exploration skills installées
│   │   │   ├── runs/[runId]/         # Timeline d’une exécution + coûts
│   │   │   ├── memory/
│   │   │   ├── workflows/
│   │   │   ├── artifacts/
│   │   │   ├── marketplace/          # (Phase marketplace) discovery unifiée
│   │   │   └── settings/
│   │   ├── admin/
│   │   └── billing/
│   └── api/
│
├── components/
│   ├── chat/
│   ├── agents/
│   ├── personas/
│   ├── skills/
│   ├── runs/
│   ├── memory/
│   ├── marketplace/
│   └── layout/
│
├── features/
│   ├── chat/
│   ├── agents/
│   ├── personas/
│   ├── skills/
│   ├── billing/
│   └── settings/
│
├── lib/
│   ├── api-client.ts
│   ├── realtime.ts
│   └── auth.ts
│
└── styles/
```

### 11.2 Expériences UI critiques

1. **Chat Orchestré** — L’utilisateur parle à Adam ; l’UI montre délégations, skills invoquées, coûts.
2. **Run Timeline** — Graphe des tâches, skills, tool calls, latences, $ tokens.
3. **Agent Console** — Persona (8 dimensions), skills, tools, model profiles, quotas.
4. **Skill Library** — Skills installées, agents consommateurs, versions.
5. **Memory Explorer** — Gouvernance des souvenirs organisationnels.
6. **Artifact Gallery** — Livrables structurés.
7. **Marketplace (futur)** — Discovery unifiée multi-kind.

### 11.3 Principes frontend

- Le frontend **ne connaît pas** la logique métier des agents/skills.
- Il consomme des contrats : `Run`, `AgentStep`, `SkillInvocation`, `Artifact`, `StreamEvent`, `ResolvedPersona`.
- Streaming prioritaire.
- Design system dans `packages/ui`.

---

## 12. Architecture backend

### 12.1 Découpage des services

| Service            | Responsabilité                                      | Scaling        |
|--------------------|-----------------------------------------------------|----------------|
| `api`              | REST/Webhooks, auth, CRUD domaine, marketplace API  | Horizontal     |
| `verse-core`       | Cœur technique (orchestration, engines, adapters)   | Horizontal     |
| `agent-runtime`    | Exécution agents (Kernel client)                    | Horizontal (par file) |
| `worker`           | Jobs longs (sync, exports, embeddings, installs)    | Horizontal     |

**MVP pragmatique (ADR-001 Accepted — Option C) :** `api` + Core **embarqué in-process** via `packages/verse-core`, exposé uniquement par une **façade publique** ; `agent-runtime` en process séparé. Aucun controller / service API n’accède aux modules internes du Core. Extraction vers `apps/verse-core` autonome reportée selon critères ADR-001.

> **V1 → V2 :** le service `orchestrator` dédié « Adam Core » est **remplacé conceptuellement** par **Verse Core**. Adam tourne dans `agent-runtime` comme les autres.

### 12.2 Modules NestJS (`apps/api`)

```
apps/api/src/
├── modules/
│   ├── identity/
│   ├── tenancy/
│   ├── workspaces/
│   ├── conversations/
│   ├── runs/
│   ├── agents-registry/
│   ├── personas/
│   ├── skills-registry/
│   ├── tools-registry/
│   ├── prompts-registry/
│   ├── packages/              # fondation marketplace
│   ├── permissions/
│   ├── memory/                # façade admin ; exécution via Core
│   ├── workflows/
│   ├── artifacts/
│   ├── billing/
│   ├── webhooks/
│   ├── audit/
│   └── health/
├── common/
└── main.ts
```

### 12.3 Verse Core (service / lib)

Responsabilités : voir **§5**.  
Point important : l’API Gateway n’embarque pas la logique LLM/mémoire/orchestration en silo — elle délègue au Core.

### 12.4 Agent Runtime (ADR-006)

Runtime **Verse natif** — aucune dépendance à un framework d’agents externe au MVP.

- Charge manifests agents + bindings persona/skills
- Souscrit aux tasks agents via **API Bus** (pas Redis Streams direct)
- Injecte `KernelClient` scoped (grants, budget, run) — **seule** I/O externe
- Boucle agent : **Reason → Plan → Act → Observe → Reflect** (pas de graphe interne)
- Skills : petites, réutilisables, **stateless**
- Collaboration inter-agents : **Bus + Workflows** uniquement
- DAG / orchestration complexe : **Workflow Engine** (Core), pas le Runtime agent
- Interfaces swappables : `AgentExecutor`, `Planner`, `SkillResolver`, `ToolExecutor`, `MemoryResolver`, `Evaluator`
- Capacités natives : evals, traces, métriques, coûts, événements
- Framework tiers éventuel (ex. LangGraph) : seulement derrière `AgentExecutor`, ADR dédié requis
- Timeouts, circuit breakers, DLQ

---

## 13. Organisation des agents

### 13.1 Modèle mental (V2)

Un agent AT72 Verse =

**Manifeste + Persona (config) + Skills (réfs) + Tools (réfs) + Handlers légers**

Il n’est **pas** :

- un simple system prompt en base ;
- le propriétaire de l’orchestration plateforme (réservé au Core) ;
- un accès direct à l’infra.

### 13.2 Agent Manifest (contrat V2)

```text
AgentManifest {
  id: "nova"
  name: "Nova"
  version: "1.2.0"
  role: "content_creation"
  description: "..."
  kind: "specialist" | "orchestrator" | "utility"
  default_persona: "persona.nova.default"
  skills: ["skill.writing", "skill.translation", "skill.seo"]
  tools_allowlist: ["web-search", "file-write", "cms-publish"]
  memory_scopes: ["org.brand", "org.content", "run.working"]
  default_model_profile: "creative-balanced"   # overridable by persona
  constraints: {
    max_tokens_per_run: 50000
    max_tool_calls: 20
    max_skill_invocations: 30
    timeout_ms: 120000
  }
  routing_hints: {
    keywords: ["rédige", "article", "post"],
    skill_tags: ["content", "copy"],
    priority: 10
  }
  can_consult: ["astra"]
  ui: { avatar, color_token, short_label }
  package: { kind: "agent", ... }              # lien marketplace
}
```

### 13.3 Structure d’un package agent (V2)

```
agents/nova/
├── agent.manifest.json
├── src/
│   ├── index.ts                 # register(agentRuntime)
│   ├── handlers/                # orchestration locale minimale
│   │   └── onTask.ts
│   └── evals/
├── package.json
└── README.md
```

Personnalité, ton, style, règles, prompts → **`personas/`** + **`prompts/`** + Persona Engine.  
Logique réutilisable → **`skills/`**.

### 13.4 Taxonomie

| Kind            | Exemple | Peut déléguer ? | Skills typiques |
|-----------------|---------|-----------------|-----------------|
| `orchestrator`  | Adam    | Oui             | `skill.orchestration` |
| `specialist`    | Nova…   | Rare / limité   | Skills domaine |
| `utility`       | futurs  | Non             | Skills étroites |

### 13.5 Registry

Le **Agents Registry** (sous Package Registry) :

- découvre les agents installés ;
- active/désactive par tenant / workspace / plan ;
- versionne manifests ;
- expose index de capabilities **et** skills pour le routing Core ;
- hot-reload dev / blue-green prod.

### 13.6 Scalabilité à 100+ agents

- Scaffolding agent / persona / skill
- Tests de contrat sur manifests
- Pools workers par famille
- Marketplace first-party vs third-party signés
- Quotas CPU/LLM/cost par agent

---

## 14. Système de communication inter-agents

### 14.1 Principe

Les agents **ne s’appellent pas directement**. Ils communiquent via :

1. **Verse Kernel** (`orchestration.delegate`, `orchestration.ask`, …)
2. **Message Bus** (événements / commandes gérés par Core)
3. **Shared Run State**
4. **Mémoire partagée scoped** (si permissions)

Adam reste le coordinateur *par défaut* (agent). Des workflows déclaratifs peuvent aussi coordonner via le Workflow Engine du Core.

### 14.2 Bus abstrait & enveloppe de message (ADR-003)

Le bus est consommé **uniquement** via une API générique : **Publish / Subscribe / Request-Reply / Broadcast**.  
Producteurs et consommateurs ne connaissent **jamais** Redis Streams (détail d’adapter). Migration future vers NATS JetStream = nouvel adapter, sans modification du code métier.

Enveloppe **obligatoire** (champs minimaux) :

```text
BusMessage {
  event_id          # identifiant unique du message
  correlation_id    # corrélation bout-en-bout
  causation_id      # cause (message / événement parent)
  tenant_id
  workspace_id
  run_id            # nullable si hors run
  timestamp         # UTC
  version           # version du schéma d'événement
  event_type        # ex. "task.completed"
  payload           # corps schema-validé
}
```

Champs d’extension possibles (versionnés, non bloquants pour les consommateurs qui les ignorent) :  
`source_agent`, `target_agent`, `authz`, `budget`, `priority`, `message_kind` (`command`|`event`|`query`|`response`), etc.

**Versionnement :** tout `event_type` évolue via `version` ; breaking changes = nouvelle version (+ stratégie de transition si besoin).

### 14.3 Patterns de collaboration

| Pattern              | Usage                                      |
|----------------------|--------------------------------------------|
| **Delegate**         | Adam → Nova : exécute une sous-tâche       |
| **Fan-out / Fan-in** | Adam → Pixel + Nova en parallèle, puis merge |
| **Ask / Consult**    | Nova → Astra : validation SEO ponctuelle   |
| **Handoff**          | Kira → Neo : lead détecté en support       |
| **Broadcast**        | Vega publie une alerte veille              |
| **Compensate**       | Rollback / correction après échec partiel  |
| **Skill-share**      | Deux agents invoquent la même Skill isolément |

Les communications **Ask/Consult** entre spécialistes sont autorisées **uniquement** si :

- le manifeste source déclare `can_consult`, **et**
- une policy tenant ne l’interdit pas, **et**
- Adam (ou le workflow) a ouvert un scope de collaboration pour le run, **et**
- l’appel passe par le **Kernel** (jamais HTTP direct).

### 14.4 Topics / files recommandés

```
runs.commands
runs.events
agent.adam.tasks
agent.nova.tasks
agent.orion.tasks
...
agent.*.events
skills.invocation.events
tools.execution.requests
tools.execution.results
memory.write.requests
billing.usage.events
packages.lifecycle.events
audit.events
```

### 14.5 Garanties

- **At-least-once** + idempotency keys
- DLQ par agent
- Timeouts et heartbeats
- Ordering par `run_id` (partition key) si nécessaire

---

## 15. Base de données

### 15.1 Stratégie multi-store

| Store            | Usage                                      |
|------------------|--------------------------------------------|
| **PostgreSQL**   | Source of truth relationnelle              |
| **Redis**        | Cache, locks, rate limits, working memory chaude |
| **Vector (pgvector/Qdrant)** | Embeddings, recall sémantique     |
| **Object Storage** | Fichiers, médias, artefacts, packages     |
| **(Optionnel) ClickHouse** | Analytics usage / coûts à l’échelle   |

Accès **uniquement** via adapters Verse Core (jamais depuis agents).

### 15.2 Modèle de données conceptuel (PostgreSQL)

#### Identité & tenancy
- `organizations`
- `users`
- `memberships`
- `workspaces`
- `workspace_members`

#### Packages & registry (marketplace-ready)
- `packages`
- `package_versions`
- `package_signatures`
- `tenant_packages` (installs)
- `workspace_packages` (enablement)

#### Agents & configuration
- `agent_definitions`
- `agent_versions`
- `tenant_agent_settings`
- `workspace_agent_settings`

#### Personas
- `persona_definitions`
- `persona_versions`
- `org_persona_overrides`
- `workspace_persona_overrides`

#### Skills
- `skill_definitions`
- `skill_versions`
- `agent_skill_bindings`
- `tenant_skill_settings`

#### Prompts
- `prompt_packs`
- `prompt_pack_versions`

#### Conversations & exécution
- `conversations`
- `messages`
- `runs`
- `run_steps`
- `run_skill_invocations`
- `run_artifacts`
- `run_events`
- `run_cost_ledger`

#### Mémoire
- `memory_records`
- `memory_embeddings`
- `memory_links`

#### Tools & workflows
- `tool_definitions`
- `tool_versions`
- `tenant_tool_credentials`
- `workflow_definitions`
- `workflow_runs`

#### Permissions & audit
- `roles`
- `permissions`
- `role_permissions`
- `resource_acl`
- `audit_logs`

#### Billing
- `organization_billing` (status provider-agnostic · grace)
- `payment_events` (webhook ledger idempotent)
- Plans techniques `free` / `pro` / `enterprise` (quotas) — montants via env, pas d’IDs vendor en métier
- Port `PaymentProvider` (SumUp MVP · Stripe futur)

### 15.3 Schéma clé : `runs` / `run_steps`

- Un **Run** = unité d’exécution.
- Des **RunSteps** forment un DAG : agent, skills invoquées, tools, status, usage, coûts.
- `run_cost_ledger` alimente billing et budgets Core.

### 15.4 Isolation tenant

- `organization_id` / `tenant_id` sur toutes les tables métier.
- RLS PostgreSQL recommandée.
- Interdiction cross-tenant hors jobs système.

---

## 16. Système mémoire

### 16.1 Couches de mémoire

```
┌─────────────────────────────────────────────┐
│ L0 — Context Window (éphémère, LLM)         │
├─────────────────────────────────────────────┤
│ L1 — Working Memory (run / session)         │
├─────────────────────────────────────────────┤
│ L2 — Conversation Memory (thread)           │
├─────────────────────────────────────────────┤
│ L3 — Agent Memory (préférences / persona)   │
├─────────────────────────────────────────────┤
│ L4 — Organization Memory (brand, facts)     │
├─────────────────────────────────────────────┤
│ L5 — Knowledge Base (docs, RAG)             │
└─────────────────────────────────────────────┘
```

Géré par le **Memory Gateway** de Verse Core ; exposé aux agents uniquement via `Kernel.memory.*`.

### 16.2 Types de records

| Type            | Exemple                              | Durée        |
|-----------------|--------------------------------------|--------------|
| `ephemeral`     | Brouillon de plan Adam               | Durée du run |
| `conversational`| Résumé de thread                     | Moyen        |
| `factual`       | “Tone of voice = premium”            | Long terme   |
| `procedural`    | “Toujours valider SEO via skill.seo” | Long terme   |
| `artifact_ref`  | Lien vers un livrable                | Long terme   |
| `credential_ref`| Référence d’intégration              | Vault        |

### 16.3 Scopes

- `run:*`
- `conversation:*`
- `agent:{id}`
- `persona:{id}`
- `workspace:*`
- `organization:*`
- `user:*`

### 16.4 Opérations

`remember` · `recall` · `summarize` · `forget` / `tombstone` · `pin` · `link`

### 16.5 Compaction & hygiène

Résumés hiérarchiques, TTL working memory, dedup sémantique, rétention par plan, export/delete RGPD.

### 16.6 Mémoire partagée inter-agents

Nova écrit `org.brand.tone` ; Pulse le relit.  
Adam écrit un brief dans `run.working` pour le fan-out.  
Les scopes autorisés viennent de la **ResolvedPersona** + grants.

---

## 17. Système de permissions

### 17.1 Modèle en couches (V2 + ADR-004)

1. **Authentification (IdP)** — session / identity via `packages/auth` (Clerk au MVP, ADR-004). **Aucun droit métier** ici.
2. **Utilisateur → Organisation/Workspace** (RBAC Verse, source de vérité = PostgreSQL)
3. **Utilisateur/Agent → Ressources** (ACL / ABAC)
4. **Agent → Skills / Tools / Memory / Autres agents** (capabilities)
5. **Package install → Permissions requested** (marketplace consent)

> **ADR-004 :** rôles d’authentification (utilisateur connecté) ≠ rôles métier (`owner`, `admin`, `editor`, …). Ces derniers sont **exclusivement** gérés par Verse.

### 17.2 Rôles utilisateurs

| Rôle            | Droits principaux                          |
|-----------------|--------------------------------------------|
| `owner`         | Billing, suppression org, SSO              |
| `admin`         | Membres, agents, skills, integrations, policies |
| `editor`        | Chat, workflows, artefacts, mémoire, personas |
| `operator`      | Exécution, monitoring runs                 |
| `viewer`        | Lecture seule                              |
| `billing`       | Facturation uniquement                     |

### 17.3 Permissions agents / skills / tools

Pour chaque tenant :

- Packages installés / enablement
- Agents activés
- Skills autorisées par agent
- Tools autorisés par agent/skill
- Scopes mémoire
- Budgets & model profiles
- Accès PII
- HITL pour side-effects

### 17.4 Exemple de grant

```text
PermissionGrant {
  principal: { type: "agent", id: "pulse" }
  actions: [
    "skill.invoke:social-scheduling",
    "tool.execute:social-publish",
    "memory.read:org.brand"
  ]
  conditions: {
    workspace_ids: ["..."]
    require_approval: true
  }
}
```

### 17.5 Enforcement points

- API Guards
- **Verse Kernel** (gate obligatoire)
- Verse Core Policy Engine
- Tool sandbox
- Memory Gateway
- Package install consent
- Frontend (UX only)

---

## 18. Outils (Tools)

### 18.1 Philosophie

Les **tools** sont des capacités atomiques, testables, auditées.  
Les **skills** composent les tools.  
Les **agents** composent skills (+ tools ponctuels).  
Adam n’appelle les tools métier qu’exceptionnellement (via Kernel).

### 18.2 ToolSpec

```text
ToolSpec {
  id: "seo-audit"
  version: "2.0.1"
  description: "..."
  input_schema: JSONSchema
  output_schema: JSONSchema
  side_effect: false | true
  auth: { type: "oauth" | "api_key" | "none" }
  timeout_ms
  retry_policy
  rate_limit
  permission: "tool.execute:seo-audit"
  categories: ["seo"]
  package: { kind: "tool" }
}
```

### 18.3 Catalogue initial (mapping)

| Tool                 | Skills / Agents typiques        | Side-effect |
|----------------------|---------------------------------|-------------|
| `web-search`         | analysis, seo, writing          | Non         |
| `http-request`       | automations (Nexus)             | Selon       |
| `file-read-write`    | writing, analysis               | Oui         |
| `image-generate`     | image-generation (Pixel)        | Oui         |
| `video-pipeline`     | Nyx skills                      | Oui         |
| `seo-audit`          | skill.seo                       | Non         |
| `cms-publish`        | writing, seo                    | Oui         |
| `social-publish`     | social-scheduling               | Oui         |
| `gmb-sync`           | local-presence                  | Oui         |
| `crm-sync`           | crm-assist                      | Oui         |
| `ticket-update`      | support-triage                  | Oui         |
| `automation-trigger` | Nexus                           | Oui         |
| `analytics-query`    | analysis                        | Non         |

### 18.4 Exécution (via Kernel)

```
Agent/Skill → Kernel.tools.execute
                → Core Tool Runtime
                   → permission · budget · sandbox
                   → Connector → External API
                   → audit + cost ledger
```

### 18.5 Connecteurs

OAuth / API keys / webhooks gérés au niveau tenant (Vault), injectés par le Core — jamais dans le code agent.

---

## 19. Providers LLM

### 19.1 Gestion dans Verse Core

Les providers sont gérés par le **LLM Provider Manager** du Core, exposés uniquement via `Kernel.llm.*`.

```text
LLMProvider {
  id: "openai" | "anthropic" | "google" | "azure-openai" | "mistral" | "local"
  complete(request): Completion
  stream(request): AsyncIterable<Chunk>
  embed(request): Embedding
}
```

### 19.2 Credentials & BYOK (ADR-005)

- Core **BYOK-ready** dès la conception ; **BYOK désactivé au MVP** (clés plateforme actives).
- **Credential Resolver** (Provider Manager seul responsable), priorité :
  1. Clé **Agent** (future)
  2. Clé **Organisation** — BYOK (prévu, off au MVP)
  3. Clé **Workspace** (future)
  4. Clé **Plateforme** (actif au MVP)
  5. **Refus** si aucune clé
- Agents / Skills / Workflows : **aucune** connaissance de l’origine des clés ; **aucun** accès secrets.
- Secrets : **coffre chiffré uniquement** ; jamais en clair ; jamais exposés aux agents.
- Cost Engine : champ obligatoire `credential_source` ∈ {`platform`,`organization`,`workspace`,`agent`} sur chaque usage tokens.

### 19.3 Model Profiles (Profils IA)

| Profile               | Usage                         |
|-----------------------|-------------------------------|
| `orchestrate-precise` | Adam / skill.orchestration    |
| `creative-balanced`   | writing, image briefs         |
| `analytic-strict`     | analysis, veille              |
| `fast-cheap`          | classifiers, routers          |
| `long-context`        | Gros documents                |
| `code-automation`     | Nexus / automations           |

Le **Model Router** mappe `profile → provider/model` selon disponibilité, coût, latence, résidence des données, overrides tenant / persona. Indépendant de la source de credentials.

### 19.4 Politiques

- Fallback automatique
- Budget par run / tenant (Cost Engine)
- Redaction PII (Security policies)
- Cache sémantique optionnel
- Usage → billing (avec `credential_source`)

### 19.5 Séparation prompts / code

- Prompt packs versionnés (`prompts/`)
- Liés aux skills / personas
- Eval harness
- Marketplace `prompt_pack` ready

---

## 20. Workflows

### 20.1 Deux modes d’orchestration

1. **Chat libre (Adam agent)** — intention dynamique, plan ad hoc via Core  
2. **Workflows déclaratifs** — processus métier reproductibles (Workflow Engine Core)

### 20.2 Workflow Definition

```text
WorkflowDefinition {
  id: "content-campaign"
  trigger: "manual" | "schedule" | "webhook" | "event"
  steps: [
    { id: "brief", agent: "adam", skill: "skill.orchestration" },
    { id: "copy", agent: "nova", skill: "skill.writing", needs: ["brief"] },
    { id: "seo", agent: "astra", skill: "skill.seo", needs: ["copy"] },
    { id: "visual", agent: "pixel", skill: "skill.image-generation",
      needs: ["copy"], parallel_group: "assets" },
    { id: "video", agent: "nyx", needs: ["copy"], parallel_group: "assets" },
    { id: "schedule", agent: "pulse", skill: "skill.social-scheduling",
      needs: ["seo", "visual"] }
  ]
  policies: { require_approval_before: ["schedule"] }
  package: { kind: "workflow" }
}
```

### 20.3 Workflows initiaux recommandés

| Workflow              | Agents / Skills                    | Valeur           |
|-----------------------|------------------------------------|------------------|
| Campagne contenu      | Adam, Nova, Astra, Pixel, Pulse    | Go-to-market     |
| Boost local SEO       | Astra, Echo, Nova                  | Visibilité locale|
| Triage support        | Kira → Neo                         | CS + sales       |
| Veille → action       | Vega → Orion → Nova/Pulse          | Insight→exec     |
| Onboarding commercial | Neo, Nova, Pixel                   | Assets de vente  |

### 20.4 Engine

- Graphe, parallélisme, reprise crash
- HITL hooks
- Même bus / Kernel que le chat
- Installable via marketplace `workflow`

---

## 21. API

### 21.1 Style

- **REST** principal + OpenAPI
- **SSE/WebSocket** streaming runs
- **Webhooks** sortants
- **SDK TypeScript** (`packages/sdk`)

### 21.2 Groupes d’endpoints

#### Identity & tenancy
- `POST /auth/*` · `GET /me`
- `CRUD /organizations`, `/workspaces`, `/members`

#### Agents & personas
- `GET /agents`
- `GET /agents/:id`
- `PATCH /workspaces/:id/agents/:agentId`
- `GET/PATCH /personas/:id`
- `POST /personas/:id/preview`

#### Skills
- `GET /skills`
- `GET /skills/:id`
- `PUT /agents/:id/skills` — bindings

#### Conversations & runs
- `POST /workspaces/:id/conversations`
- `POST /conversations/:id/messages`
- `GET /runs/:id` · `/steps` · `/stream` · `/costs`
- `POST /runs/:id/cancel` · `/approve`

#### Memory
- `GET /workspaces/:id/memory`
- `POST /workspaces/:id/memory/search`
- `DELETE /memory/:id`

#### Tools & integrations
- `GET /tools`
- `POST /integrations/:provider/connect`

#### Workflows
- `GET /workflows`
- `POST /workflows/:id/run`

#### Packages / Marketplace foundations
- `GET /packages?kind=agent|skill|tool|workflow|prompt_pack`
- `POST /packages/:id/install`
- `DELETE /packages/:id/uninstall`
- `GET /marketplace/search` *(futur, même backend)*

#### Artifacts, admin, billing
- `GET /artifacts/:id` · `POST /files/upload`
- `GET /usage` · `/billing/subscription` · `/audit-logs`

### 21.3 Versioning & idempotence

- Préfixe `/v1`
- Semver packages
- Idempotency keys sur POST side-effect

---

## 22. Modules futurs

| Module                    | Description                                      | Impact archi                |
|---------------------------|--------------------------------------------------|-----------------------------|
| **Marketplace UI complète** | 5 catalogs (agents, skills, tools, workflows, prompts) | Registry déjà prévu     |
| **Custom Agents Builder** | No-code agents (persona + skills)                | Manifest editor + evals     |
| **Skill Builder**         | Création visuelle de skills                      | Skill Engine                |
| **Voice Interface**       | Adam vocal                                       | Media pipeline              |
| **Multi-modal Studio**    | Hub Pixel/Nyx                                    | Artifact graph              |
| **Enterprise SSO / SCIM** | Provisioning RH                                  | Identity                    |
| **Data Residency**        | EU/US isolation                                  | Router + adapters           |
| **Evaluation Lab**        | Bench agents/skills                              | Datasets                    |
| **Policy Engine avancé**  | OPA / Cedar                                      | Authz Core                  |
| **Human Task Inbox**      | Approbations                                     | HITL                        |
| **CRM/ERP Packs**         | Connecteurs verticalisés                         | Tools marketplace           |
| **White-label**           | Marque client                                    | Theming                     |
| **On-prem / VPC**         | Clients régulés                                  | Helm                        |
| **Agent-to-Agent economy**| Budgets internes                                 | Cost Engine                 |
| **Simulation mode**       | Dry-run tools                                    | Side-effect flags           |
| **Third-party publishers**| Programme partenaires                            | Signature & trust           |

Les seams V2 (Kernel, Core, Package Registry, Persona, Skill) rendent ces modules **additifs**.

---

## 23. Multi-tenancy & isolation

### 23.1 Modèle

- **Organization** = tenant de facturation
- **Workspace** = unité de collaboration
- Un user peut appartenir à plusieurs orgs

### 23.2 Isolation

| Couche     | Mécanisme                              |
|------------|----------------------------------------|
| Données    | `organization_id` + RLS                |
| Secrets    | Vault par tenant                       |
| Exécution  | Kernel context + grants snapshot       |
| LLM        | Clés plateforme ou BYOK                |
| Storage    | Préfixe `org/{id}/...`                 |
| Packages   | Installs isolées par tenant            |
| Réseau     | Rate limits par tenant                 |

### 23.3 Quotas

Messages/runs · Tokens · Storage · Agents actifs · Skills · Tool side-effects · Concurrency · Coût $ max

---

## 24. Observabilité, sécurité & résilience

### 24.1 Observabilité

- Traces OTel par `run_id` / `correlation_id` / `skill_id`
- Metrics : latence agent/skill/tool, coût $, profondeur files, kernel reject rate
- Logs JSON
- UI Run debugger (`run_steps` + skill invocations + cost ledger)

### 24.2 Sécurité

- OAuth2/OIDC, MFA
- Secrets vault
- **Kernel as mandatory chokepoint**
- Sandbox tools + allowlists
- JSON Schema strict
- Encryption at rest / in transit
- Audit append-only
- Prompt injection defenses
- Package signature verification
- RGPD export/delete

### 24.3 Résilience

- Retries + jitter
- Circuit breakers LLM
- DLQ + replay
- Idempotency
- Graceful degradation (orchestration Core + Adam read-only tools)
- Backpressure

---

## 25. Stratégie d’évolution & phases

> **Roadmap opérationnelle détaillée :** voir [`ROADMAP.md`](./ROADMAP.md)  
> (40 phases de développement, de la première ligne de code jusqu’à la GA commerciale, + phases post-GA 41–48).

### Synthèse des jalons (alignée roadmap)

| Jalon | Phases roadmap | Livrable |
|-------|----------------|----------|
| **J0 Foundations** | P01–P06 | Monorepo, auth, org/workspace |
| **J1 Kernel/Core** | P07–P11 | Kernel, Core, bus, runs |
| **J2 First Run** | P12–P16 | Adam → Nova + chat stream (**atteint à P12**) |
| **J3 Engines** | P17–P22 | Socle LLM (**atteint à P13**) · Persona, memory, tools, authz, cost, registry |
| **J4 Multi-agent** | P23–P27 | Adam + Nova + Skills (**atteint à P14**) · délégation / Squad / fan-out / workflow |
| **J5 Platform** | P28–P33 | Orchestration Adam→Nova + DAG (**atteint à P15**) · UI chat · OAuth / HITL / obs. |
| **J6 SaaS commercial** | P34–P40 | First Run UX chat (**atteint à P16**) · Billing / onboarding / prod / GA |
| **J7 Persona Engine** | P17 | Identité agents configurable (**atteint à P17**) · Memory / Tools / Authz / Costs (P18–22) |
| **J8 Memory Gateway** | P18 | Mémoire L1/L2 plateforme (**atteint à P18**) · Tools / Authz / Costs (P19–22) |
| **J9 Tool Runtime** | P19 | Tools atomiques + audit (**atteint à P19**) · Authz / Costs (P20–22) |
| **J10 Permissions** | P20 | Capability grants + Permission Engine (**atteint à P20**) · Costs (P21–22) |
| **J11 Cost Engine** | P21 | Budgets run + Rate Card (**atteint à P21**) · Registry (P22) |
| **J12 Package Registry** | P22 | Catalogue first-party + install/pin (**atteint à P22**) |
| **J13 Squad specialists** | P23 | Orion + Astra + Pixel (**atteint à P23**) |
| **J14 Fan-out / Consult** | P24 | Parallel campaign + Ask/Consult (**atteint à P24**) |
| **J15 Memory L4** | P25 | Org brand + embeddings (**atteint à P25**) |
| **J16 First workflow** | P26 | Workflow déclaratif content-campaign (**atteint à P26**) |
| **Post-GA** | P41–P48 | Marketplace, SSO, multi-région, builders… |

### Ancienne vue macro (conservée, détaillée dans ROADMAP)

### Phase 0 — Fondations (actuel)
- Architecture V2
- ADR (Core, Kernel, Persona, Skill, Packages)
- Contrats (`packages/contracts`)
- Docker compose

### Phase 1 — Vertical slice
- Auth + org + workspace
- **Verse Kernel + Verse Core** (embedded OK)
- Chat → **Adam (agent)** → **Nova** via Kernel
- 1 Persona Nova + 1 Skill `writing`
- 2–3 tools
- Mémoire L1 + L2
- UI chat + timeline + coûts basiques

### Phase 2 — Squad + engines
- Orion, Astra, Pixel
- Persona Engine multi-overrides
- Skill Engine (seo, analysis, image-generation)
- Fan-out / fan-in
- Memory L4 brand
- Permissions agent/skill/tool
- Premier workflow déclaratif

### Phase 3 — Plateforme
- Catalogue agents v1 complet
- Prompt packs
- Connecteurs OAuth
- Billing & quotas (Cost Engine)
- Observabilité prod
- HITL inbox
- Package Registry first-party (pré-marketplace)

### Phase 4 — Échelle & Marketplace
- 50+ agents / skills
- Marketplace UI (5 kinds)
- Signatures third-party
- Qdrant / analytics
- Multi-région
- Policy engine avancé

---

## 26. Décisions ouvertes (ADR backlog)

| ID     | Décision                                      | Options |
|--------|-----------------------------------------------|---------|
| ADR-001 | Core embedded dans `api` au MVP ?            | **Accepted — Option C** (embarqué + façade) · voir `docs/ADR/001-…` |
| ADR-002 | Kernel library vs RPC dès le MVP             | **Accepted — Option A** (library + transport opaque) · `docs/ADR/002-…` |
| ADR-003 | Event bus MVP                                 | **Accepted — Option A** (Redis Streams + Bus API opaque + envelope versionnée) · `docs/ADR/003-…` |
| ADR-004 | Auth provider                                 | **Accepted — Option B** (Clerk IdP + `packages/auth` + RBAC Verse) · `docs/ADR/004-…` |
| ADR-005 | BYOK LLM dès le MVP ?                         | **Accepted — Option C** (BYOK-ready + resolver hiérarchique ; BYOK off) · `docs/ADR/005-…` |
| ADR-006 | Framework agent interne                       | **Accepted — Option C** (Runtime Verse natif + interfaces) · `docs/ADR/006-…` |
| ADR-007 | Vector store                                  | pgvector only / Qdrant dès le départ |
| ADR-008 | GraphQL pour console                          | Non MVP / Oui |
| ADR-009 | Runtime polyglotte Python                     | Non / Sidecar futur (Kernel RPC) |
| ADR-010 | Stockage personas                             | Fichiers versionnés + DB / DB only |
| ADR-011 | Skills : code vs déclaratif                   | **Accepted — hybride** · `docs/ADR/011-skills-hybrid.md` |
| ADR-012 | Signature packages                            | Cosign / Sigstore / custom |
| ADR-013 | Tenant Secrets Vault + OAuth Connectors       | **Accepted** — port vault + LinkedIn + dual-mode · 28a/28b · OAuth API↔Core only · `docs/ADR/013-…` |

Chaque ADR : `docs/ADR/XXXX-titre.md`.

---

## Annexe A — Glossaire

| Terme              | Définition |
|--------------------|------------|
| **Verse Core**     | Cœur technique plateforme (pas un agent) |
| **Verse Kernel**   | Noyau d’abstraction ; seul I/O autorisé pour agents/skills |
| **Adam**           | Premier agent orchestrateur (utilise Core via Kernel) |
| **Agent**          | Acteur plugin : manifeste + persona + skills + handlers |
| **Persona**        | Identité configurable (personnalité, ton, style, règles…) |
| **Skill**          | Compétence réutilisable multi-agents |
| **Tool**           | Capacité atomique d’action / I/O |
| **Prompt Pack**    | Ensemble de prompts versionnés installables |
| **Package**        | Unité marketplace (agent/skill/tool/workflow/prompt) |
| **Model Profile**  | Profil IA abstrait (qualité/coût/latence) |
| **Run**            | Unité d’exécution tracée |
| **Workspace**      | Contexte de collaboration dans une org |
| **HITL**           | Human In The Loop |
| **Capability**     | Compétence routable (souvent alignée skill tags) |

## Annexe B — Critères de succès architecture (V2)

L’architecture est saine si :

1. Ajouter un agent = package + persona + bindings skills + tests, **sans modifier Core/Kernel**.
2. Ajouter une skill = package skill, **réutilisable** par plusieurs agents sans fork.
3. Modifier ton / règles / modèle = change Persona / Profile, **sans redeploy logic agent** (dans les limites des skills déjà bindées).
4. Remplacer un provider LLM = config Core, **sans toucher agents/skills**.
5. Un agent qui tente d’importer Prisma/OpenAI **échoue** aux contrôles d’architecture (lint/CI boundary).
6. Un tenant ne peut jamais lire la mémoire d’un autre.
7. Toute action side-effect est auditable, permissionnée, budgétée.
8. On peut rejouer un run (steps + skills + coûts).
9. La UI affiche le graphe de collaboration en temps réel.
10. On peut publier un package `kind=*` demain sans changer le Kernel.
11. On peut désactiver un agent/skill défaillant sans downtime global.
12. Un second agent orchestrateur peut exister **sans forker** Verse Core.

## Annexe C — Cartographie V1 → V2

| Concept V1 | Concept V2 |
|------------|------------|
| Adam Core / service orchestrator | **Verse Core** (orchestration engine) |
| Adam = cerveau plateforme | **Adam = agent orchestrateur** |
| Accès libs infra depuis runtime | **Interdit → Verse Kernel only** |
| Prompt/system dans package agent | **Persona Engine + Prompt packs** |
| Capabilities souvent = tools | **Skills** (+ tools atomiques) |
| Marketplace « module futur » | **Package Registry** dès les fondations |

---

*Fin du document d’architecture AT72 Verse v2.0 — Conception uniquement, aucune implémentation.*
