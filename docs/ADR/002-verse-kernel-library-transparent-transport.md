# ADR-002 — Verse Kernel en library avec transport transparent

- **Status:** Accepted
- **Date:** 2026-07-18
- **Deciders:** Product / Architecture (validation explicite)
- **Option retenue:** A — Kernel library + transport pluggable, **opaque pour agents/skills**
- **Dépendance:** [ADR-001](./001-verse-core-embedded-with-facade.md) (Core embarqué + façade)

## Context

Les agents et skills ne doivent accéder à l’infrastructure que via le **Verse Kernel**.

Avec ADR-001, Verse Core est embarqué dans le process `apps/api` derrière une façade publique, tandis que les agents s’exécutent dans `apps/agent-runtime` (process séparé). Il faut donc :

- un contrat Kernel unique pour tous les appelants ;
- un chemin in-process depuis `api` vers la façade Core ;
- un chemin réseau depuis `agent-runtime` vers la même façade Core ;
- sans dupliquer le Core et sans coupler les agents au mode de transport.

## Decision

**Option A — `packages/verse-kernel` (library) + transports pluggables, entièrement abstraits.**

1. Le Kernel est livré comme **package TypeScript** (`packages/verse-kernel`).
2. Agents et Skills dépendent **uniquement** de l’**API publique** du Kernel (syscalls : `llm.*`, `memory.*`, `tools.*`, `skills.*`, `orchestration.*`, etc.).
3. **Contrainte d’opacité du transport (obligatoire) :**
   - Les agents et Skills **ne connaissent jamais** le mode de communication (in-process, HTTP, gRPC, ou autre).
   - Ils n’importent aucun client HTTP/gRPC, URL, ou flag de transport.
   - Le Kernel **sélectionne automatiquement** le transport approprié selon le contexte d’exécution / la configuration plateforme.
4. Au MVP, les bindings prévus sont :
   - `apps/api` → façade Core **in-process** ;
   - `apps/agent-runtime` → façade Core via **transport réseau interne** (HTTP ou gRPC, choix d’implémentation ultérieur sans impact agents).
5. Une évolution d’infra (changement de transport, extraction du Core en service, Kernel sidecar plus tard) **ne doit nécessiter aucune modification** du code des agents ni des Skills — uniquement configuration / bindings Kernel + Core.

### Non-goals (MVP)

- Pas de process Kernel dédié (Option B reportée).
- Pas de fusion `api` + `agent-runtime` en un seul process (Option C écartée).
- Pas d’obligation « tout RPC y compris depuis api » (Option D non retenue ; possible plus tard sans casser l’API Kernel).

## Consequences

### Positive

- Contrat unique pour `agents/*` et `skills/*`.
- Cohérent avec ADR-001 (un seul Core, façade unique).
- Portabilité infra : changer HTTP → gRPC ou extraire Core sans toucher la logique métier agents/skills.
- Aligné ARCHITECTURE.md (Kernel-mediated I/O) et Phase 07/09 (boundaries CI).

### Negative

- Deux transports à maintenir et tester au MVP (in-process + réseau).
- `api` expose (en interne) la façade Core au runtime — surface à sécuriser (réseau privé, auth interne).
- Bugs de divergence de comportement entre transports possibles si la suite de tests de contrat est insuffisante.

### Neutral

- Le choix HTTP vs gRPC pour le transport runtime→Core est une décision d’implémentation (ou ADR ultérieur), **invisible** aux agents.
- Un Kernel service/sidecar (ex-Option B) reste possible plus tard derrière la même API publique.

## Alternatives considered

| Option | Résumé | Motif du rejet |
|--------|--------|----------------|
| **B** — Kernel service/sidecar RPC dès J1 | Chokepoint process dédié | Surcoût ops trop tôt |
| **C** — Un seul process (api exécute les agents) | 100 % in-process | Contredit découpage runtime ; blast radius |
| **D** — Tout en RPC même depuis api | Un seul chemin réseau | Latence inutile au MVP avec Core embarqué |

## Enforcement

- CI / dependency rules : `agents/**` et `skills/**` n’importent que `packages/verse-kernel` (et `packages/contracts`), jamais de clients réseau ni adapters Core.
- Tests de contrat Kernel identiques quel que soit le transport actif.
- Revue : aucun agent/skill ne lit de config `TRANSPORT=…` ni d’URL Core.
