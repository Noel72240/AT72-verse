# ADR-007 — Vector store (mémoire sémantique)

- **Status:** Accepted
- **Date:** 2026-07-19
- **Deciders:** Product / Architecture (validation explicite PO)
- **Option retenue:** A — **pgvector** dans PostgreSQL au MVP, derrière `MemoryStorePort` / `VectorIndexPort` (Kernel indépendant du moteur)

## Context

Phase 18 a livré le Memory Gateway L1/L2 avec recall **substring** déterministe. Phase 25 introduit la mémoire organisationnelle L4 (`org.brand` / `organization.*`) et le recall sémantique.

ARCHITECTURE V2 prévoit : **pgvector (MVP) → Qdrant (échelle)**. Aucun fichier ADR-007 n’existait encore ; l’entrée `DECISIONS.md` restait Proposed.

Il faut trancher le store vectoriel **sans** changer l’API `Kernel.memory.*` (contrainte post-J8).

## Options

| | Option | Description |
|---|--------|-------------|
| **A** | **pgvector only (MVP)** | Extension PostgreSQL + table `memory_embeddings` ; query via `MemoryStorePort` |
| **B** | Qdrant dès le départ | Service vectoriel dédié + sync depuis Postgres records |
| **C** | Dual-write pgvector + Qdrant | Complexité max, migration anticipée |

## Decision

**Option A — pgvector au MVP**, avec abstraction stricte :

1. Les agents n’accèdent qu’à `Kernel.memory.*`.
2. Le Gateway orchestre remember / recall / pin ; le store peut combiner filtre SQL + similarité cosinus.
3. Une migration ultérieure vers Qdrant (ou dual) ne change **pas** les contrats Kernel — seulement l’implémentation du port (éventuellement un `VectorIndexPort` interne).
4. Isolation tenant = filtre obligatoire `organization_id` (et workspace si applicable) **avant** le ranking vectoriel.
5. Delete organisation = cascade records **et** embeddings (preuve de validation Phase 25).

## Consequences

### Positives

- Un seul store opérationnel au MVP (aligné stack Docker Postgres existante).
- Reproductibilité locale / CI plus simple (extension pgvector dans l’image Postgres).
- Coût infra minimal.

### Négatives / risques

- Limites d’échelle / ops pgvector vs Qdrant à l’horizon SaaS dense.
- Dimension / modèle d’embedding figés dans le schéma (migration si changement de modèle).

### Suivi

- Si charge vectorielle ou multi-région l’exige : ADR de follow-up « extract Qdrant » sans casser Kernel.memory.
