# Phase 33 — Kernel chokepoint checklist (ED3)

**Date :** 2026-07-19  
**Statut :** revue interne P33

## Preuves obligatoires

| # | Critère | Preuve | Statut |
|---|---------|--------|--------|
| 1 | Aucun agent/skill n’appelle un tool hors `Kernel.tools.execute` | Depcruise boundaries · `ToolRuntime.execute` | OK |
| 2 | Grants / packages avant side-effect | ToolRuntime + PackagesService assert | OK |
| 3 | Secrets vault jamais exposés aux agents | OAuth resolve Core only (P28b) · ADR-013 | OK |
| 4 | HITL gate live inchangé | `WAITING_APPROVAL` · claim idempotent (P29) | OK |
| 5 | Signatures `Kernel.*` stables | Pas de breaking change contracts Kernel en P33 | OK |

## Notes

- P33 n’ajoute **pas** de nouvelle famille Kernel.  
- Agents restent derrière `@at72-verse/contracts` + `@at72-verse/verse-kernel` uniquement.  
- Test smoke : `packages/verse-core/src/tools/tool-runtime.test.ts` (gate + OAuth + HITL paths).

## Échec = P0

Tout contournement documenté du chokepoint bloque la clôture P33.
