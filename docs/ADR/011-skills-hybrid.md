# ADR-011 — Skills : code vs déclaratif (hybride)

- **Status:** Accepted
- **Date:** 2026-07-18
- **Deciders:** Product / Architecture (validation explicite Phase 14 / BA2)
- **Option retenue:** Hybride — `SkillSpec` déclaratif + handler TypeScript `execute`

## Context

Les Skills doivent être réutilisables multi-agents, versionnées, testables et **publiables** (Marketplace). Il faut choisir entre code pur, DSL déclaratif, ou hybride, sans violer les boundaries (Skills = `contracts` + `verse-kernel` only).

## Decision

1. Une Skill = **`SkillSpec`** (manifeste + `input_schema` / `output_schema` + métadonnées) + **`execute({ kernel, input })`**.
2. Le **manifeste / SkillSpec** est la source officielle de description (Marketplace-ready).
3. Le handler TS n’accède à l’infra **que** via `KernelClient`.
4. Compatibilité : toute évolution incompatible du contrat → **nouvelle version** semver du SkillSpec.
5. Skills **indépendantes des agents** : aucun import agent ; réutilisables sans modification.
6. Le **Runtime** héberge le registre des Skills (BB1) ; le Core ne charge jamais un package skill.

## Consequences

### Positive

- Aligné ARCHITECTURE §8
- Allow-list Phase 09 inchangée
- Eval / schemas / marketplace possibles dès P14

### Negative

- Pas de DSL pur (reporté)
- Host Runtime doit câbler `Kernel.skills.invoke` → registry

## Non-goals (P14)

- Cycle de vie `register(skillEngine)` riche (BC2)
- Topics Bus dédiés aux skills
- Composition skill→skill
