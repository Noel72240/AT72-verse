# ADR-003 — Event bus MVP : Redis Streams derrière API Bus générique

- **Status:** Accepted
- **Date:** 2026-07-18
- **Deciders:** Product / Architecture (validation explicite)
- **Option retenue:** A — Redis Streams au MVP + abstraction totale + événements versionnés

## Context

La collaboration multi-agents est event-driven (`runs.*`, `agent.*.tasks`, complétions, etc.). Il faut un bus MVP :

- durable (at-least-once) ;
- simple à opérer avec le stack local (Redis déjà prévu) ;
- remplaçable plus tard (cible naturelle : NATS JetStream) **sans modifier le code métier**.

BullMQ reste réservé aux **jobs longs** ; le bus porte les **événements / commandes de collaboration**.

## Decision

### 1. Implémentation MVP

**Redis Streams** comme moteur de transport du bus au MVP.

### 2. Abstraction obligatoire

Le bus est exposé uniquement via une **API Bus générique** (package dédié, ex. `packages/bus` + contrats dans `packages/contracts`).

Opérations minimales de l’API :

| Opération | Rôle |
|-----------|------|
| **Publish** | Publier un événement / commande |
| **Subscribe** | Consommer un flux (consumer group / handler) |
| **Request / Reply** | Interaction synchrone-asynchrone corrélée |
| **Broadcast** | Diffusion à plusieurs consommateurs |

**Règle d’opacité :** producteurs et consommateurs (API, Core, agent-runtime, workers) **ne connaissent jamais** Redis Streams (ni NATS, ni Kafka). Aucun import client Redis Streams dans le code métier. Seul l’**adapter** d’implémentation connaît Redis.

Le passage futur Redis Streams → NATS JetStream (ou autre) = **nouvel adapter** + config, **zéro changement** du code métier ni des handlers d’agents.

### 3. Enveloppe de message normalisée

Tout message transitant sur le bus **doit** respecter une enveloppe unique, comprenant **au minimum** :

| Champ | Rôle |
|-------|------|
| `event_id` | Identifiant unique du message |
| `correlation_id` | Corrélation bout-en-bout (souvent = run ou requête racine) |
| `causation_id` | Message / événement cause |
| `tenant_id` | Isolation multi-tenant |
| `workspace_id` | Contexte workspace |
| `run_id` | Unité d’exécution (nullable si hors run) |
| `timestamp` | Horodatage émission (UTC) |
| `version` | Version du **schéma d’événement** |
| `event_type` | Type logique (ex. `task.completed`) |
| `payload` | Corps typé / schema-validé |

Des champs additionnels (ex. `source`, `priority`, `authz_snapshot`) restent possibles via évolution versionnée de l’enveloppe ou extensions documentées — sans casser les consommateurs qui ignorent les champs inconnus (politique de compatibilité).

### 4. Versionnement des événements

- Chaque `event_type` a un schéma versionné (`version`).
- Évolutions **backward-compatible** privilégiées (ajout de champs optionnels).
- Breaking change = nouvelle `version` (et stratégie de dual-publish / dual-consume si nécessaire pendant transition).
- Objectif : préserver la compatibilité lors des évolutions de la plateforme.

### 5. Non-goals

- Kafka au MVP (écarté).
- Remplacer BullMQ par le bus (rôles distincts conservés).
- Exposer Redis Streams aux agents/skills (ils passent par le Kernel ; le bus est infra Core/runtime).

## Consequences

### Positive

- MVP lean (Redis déjà sur le chemin critique).
- Remplacement NATS sans réécriture métier.
- Observabilité / audit facilités par l’enveloppe normalisée.
- Compatibilité long terme via `version` + `event_type`.

### Negative

- Coût d’abstraction (interface + adapter + tests de contrat).
- Redis Streams moins expressif que NATS subjects (acceptable au MVP).
- Discipline requise : interdiction d’appeler Redis Streams hors adapter (CI).

### Neutral

- Le choix HTTP vs détails Redis (noms de streams, consumer groups) est interne à l’adapter.
- Request/Reply peut s’appuyer sur correlation_id + stream de réponses dédié.

## Alternatives considered

| Option | Résumé | Motif du rejet |
|--------|--------|----------------|
| **B** — NATS JetStream dès MVP | Cible prod précoce | +1 service trop tôt |
| **C** — Kafka dès MVP | Échelle maximale | Surdimensionné |
| **D** — BullMQ seul | Files jobs uniquement | Mauvais modèle event/collab |

## Enforcement

- Code métier → `Bus` API uniquement.
- Adapter Redis Streams isolé (ex. `packages/bus` / `adapters/redis-streams`).
- Validation schéma enveloppe à la publication.
- Tests de contrat bus indépendants de Redis (fake in-memory + adapter Redis en intégration).
