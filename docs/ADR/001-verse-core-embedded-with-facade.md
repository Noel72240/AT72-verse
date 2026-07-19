# ADR-001 — Verse Core embarqué avec façade publique (MVP)

- **Status:** Accepted
- **Date:** 2026-07-18
- **Deciders:** Product / Architecture (validation explicite)
- **Option retenue:** C — Hybride discipliné

## Context

Verse Core est le cœur technique d’AT72 Verse (orchestration, LLM, mémoire, permissions, coûts, engines, etc.). Il n’est pas un agent.

Au MVP, il faut choisir le mode de déploiement :

- bibliothèque embarquée dans le process `apps/api` ;
- ou service `apps/verse-core` autonome dès le jour 1.

L’architecture V2 et la roadmap autorisent un Core embarqué au MVP, à condition de ne pas compromettre une extraction ultérieure.

## Decision

**Option C — Core embarqué dans le process API au MVP, conçu comme composant indépendant derrière une façade publique.**

Concrètement :

1. La logique Core vit dans `packages/verse-core` (et éventuellement un squelette `apps/verse-core` non déployé au MVP).
2. `apps/api` héberge le Core **in-process** (même runtime Node au MVP).
3. **Toute** interaction avec le Core passe exclusivement par une **façade publique** clairement définie (ports / API de module).
4. Aucun controller Nest, service métier API, ni autre composant hors Core n’importe ni n’appelle les modules internes du Core (`orchestration/*`, `adapters/*`, etc.).
5. L’extraction vers un service `apps/verse-core` autonome reste un objectif supporté : elle devra pouvoir se faire plus tard avec un **minimum de modifications** (la façade devient alors un client réseau au lieu d’un binding in-process).

### Critères futurs d’extraction (non bloquants MVP)

Envisager un ADR de follow-up / extraction lorsque l’un de ces signaux apparaît :

- besoin de scaler Core indépendamment de l’API ;
- blast radius inacceptable (incident Core = downtime API) ;
- latence / charge LLM qui justifie un pool de process dédié ;
- exigence isolation réseau / sécurité renforcée.

## Consequences

### Positive

- Time-to-First-Run (J2) plus court qu’un microservice dès P08.
- Frontière architecturale claire : Core ≠ API ≠ Agents.
- Extraction ultérieure facilitée si la façade et les contrats restent stables.
- Aligné avec ARCHITECTURE.md (« embedded OK ») et ROADMAP.md.

### Negative

- Pas d’isolation runtime réelle au MVP (bug Core peut impacter l’API).
- Exige discipline d’équipe + enforcement CI (interdiction des imports internes).
- Risque de « fausse » indépendance si la façade est contournée.

### Neutral

- `apps/verse-core` peut exister comme placeholder jusqu’à l’extraction.
- ADR-002 (Kernel library vs RPC) reste indépendant mais doit rester cohérent avec ce mode (Kernel client → façade Core).

## Alternatives considered

| Option | Résumé | Motif du rejet |
|--------|--------|----------------|
| **A** — Embed « simple » sans façade stricte | Plus rapide, moins de garde-fous | Extraction douloureuse ; mélange API/Core |
| **B** — Service séparé dès J1 | Isolation maximale | Surcoût ops trop tôt pour le MVP |
| **D** — Core dans agent-runtime | Un process cerveau+workers | Contredit ARCHITECTURE (Core ≠ runtime agents) |
