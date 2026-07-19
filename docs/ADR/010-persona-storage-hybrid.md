# ADR-010 — Persona storage (hybride)

- **Status:** Accepted
- **Date:** 2026-07-19
- **Deciders:** Product / Architecture (validation explicite Phase 17 / DA1)

## Context

Les personas doivent être configurables sans redeploy des packages agents (ARCHITECTURE §7).  
Les defaults first-party doivent rester versionnés et auditables ; les tenants doivent pouvoir surcharger ton / règles par org et workspace.

## Decision

**Option C — hybride :**

1. **First-party** : `PersonaSpec` versionnées dans le dépôt (`personas/*.json`), seedées dans le Persona Engine Core.
2. **Overrides** : patches Organisation / Workspace persistés en base (`persona_overrides`), appliqués au merge.

`Kernel.persona.resolve` produit une **`ResolvedPersona` immuable** (merge déterministe `system → agent → organization → workspace`) avec **provenance** des couches.

## Consequences

### Positive

- Defaults cohérents + personnalisation sans redeploy
- Core reste sans Prisma (overrides via `PersonaOverridePort` / payload stamp)
- Prêt pour futurs agents (resolve par `agent_id` générique)

### Negative

- Deux sources de vérité (fichiers + DB) à documenter
- Runtime reçoit les overrides stampés à la dispatch (pas de lecture Prisma)

### Neutral

- Couches `user` / `run` différées (extensibles sans casser le modèle)

## Alternatives considered

| Option | Pourquoi écartée |
|--------|------------------|
| A — Fichiers only | Pas de personnalisation tenant |
| B — DB only | Defaults first-party moins auditables / git-friendly |
