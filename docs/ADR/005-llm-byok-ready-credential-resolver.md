# ADR-005 — LLM credentials : BYOK-ready + Credential Resolver hiérarchique

- **Status:** Accepted
- **Date:** 2026-07-18
- **Deciders:** Product / Architecture (validation explicite)
- **Option retenue:** C — BYOK-ready dès la conception ; BYOK **désactivé** au MVP ; resolver hiérarchique

## Context

Les appels LLM passent exclusivement par Verse Kernel → Verse Core (Provider Manager). Il faut décider si les tenants peuvent apporter leurs propres clés (BYOK) au MVP, tout en préservant :

- un onboarding / démo simples (clés plateforme) ;
- l’opacité totale pour agents, skills et workflows ;
- une facturation future capable de distinguer l’origine des tokens ;
- un stockage secrets sécurisé (jamais en clair, jamais exposé aux agents).

## Decision

### 1. Stratégie produit

- Le Core est **BYOK-ready dès sa conception** (Phase 13+).
- La fonctionnalité BYOK reste **désactivée au MVP** (feature flag / plan).
- Au MVP, seul le chemin **clé plateforme** est actif en production ; les seams pour org/workspace/agent existent déjà.

### 2. Opacité totale

- **Agents, Skills et Workflows** ne connaissent **jamais** l’origine des credentials (platform / organization / workspace / agent).
- Ils n’ont aucun accès aux secrets, clés API, ou références vault.
- Le **Provider Manager** (Verse Core) est **seul** responsable de la résolution des credentials.
- Le choix clé plateforme vs clé tenant est **transparent** pour le reste du système (Kernel API LLM inchangée).

### 3. Credential Resolver — ordre de priorité

Lors d’un appel LLM, le resolver évalue **dans cet ordre** :

| Priorité | Source | Statut |
|----------|--------|--------|
| 1 | Clé spécifique à un **Agent** | Future évolution (seam prévu) |
| 2 | Clé de l’**Organisation** (BYOK) | Prévu ; **off** au MVP |
| 3 | Clé **Workspace** | Future évolution (seam prévu) |
| 4 | Clé **Plateforme** | **Actif au MVP** |
| 5 | **Refus** si aucune clé disponible | Erreur normalisée Kernel/Core |

Dès qu’une source applicable est trouvée **et autorisée** (flag, plan, permissions), elle est utilisée ; sinon on descend la chaîne jusqu’au refus.

### 4. Cost Engine — origine des tokens

Chaque consommation LLM enregistrée dans le ledger doit inclure l’**origine des credentials** utilisée, parmi :

- `platform`
- `organization`
- `workspace`
- `agent`

Objectif : préparer la facturation différenciée **sans modifier l’architecture** le jour où BYOK (et niveaux fins) seront activés. Même au MVP (quasi exclusivement `platform`), le champ d’origine est **obligatoire** dans le ledger.

### 5. Secrets & coffre

- Tous les secrets LLM (plateforme et futurs tenant) sont **chiffrés** et stockés dans un **coffre sécurisé** (vault).
- Jamais en clair en base applicative, logs, traces, ou payloads bus.
- **Jamais** accessibles directement aux agents, skills, workflows, ou au frontend.
- Seuls Provider Manager / adapter secrets (Core) résolvent une référence → clé éphémère en mémoire pour l’appel.

### 6. Non-goals (MVP)

- UI BYOK / saisie de clés org.
- Activation réelle des niveaux agent / workspace.
- Facturation pass-through BYOK (préparée via ledger, non exposée produit).

## Consequences

### Positive

- First Run simple (clés plateforme).
- Activation BYOK ultérieure sans refonte Provider Manager.
- Agents/skills stables quel que soit le modèle économique LLM.
- Ledger prêt pour billing multi-origine.

### Negative

- Design P13 légèrement plus riche qu’un hardcode de clé env.
- Tests du resolver (chemins off) à maintenir.
- Discipline stricte vault / redaction logs.

### Neutral

- Le vendor vault (Doppler, AWS Secrets Manager, Vault, etc.) peut être choisi en phase infra sans changer cet ADR (port secrets).
- Model Profiles restent indépendants de la source de credentials.

## Alternatives considered

| Option | Résumé | Motif du rejet |
|--------|--------|----------------|
| **A** — BYOK actif dès MVP | Clés tenant dès P13 | Complexité UX/support trop tôt |
| **B** — Platform only sans seams | Plus simple | Dette pour BYOK / multi-niveau |
| **D** — BYOK obligatoire | Pas de clés plateforme | Friction onboarding incompatible SaaS |

## Enforcement

- Aucun import de secrets / env LLM dans `agents/**`, `skills/**`, `workflows/**`.
- Appels LLM uniquement via `Kernel.llm.*` → Provider Manager → Credential Resolver.
- CI / revue : pas de `OPENAI_API_KEY` dans le code agent.
- Cost ledger : champ `credential_source` obligatoire.
