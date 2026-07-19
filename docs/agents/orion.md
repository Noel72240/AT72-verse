# Agent: Orion

Analysis specialist (Phase 23).

## Role

Produce structured insights via `skill.analysis` only (explicit Kernel invoke).

## Skills

- `skill.analysis` (binding explicite dans `handleTask`)

## Tools

- `web-search` (opt-in via task flag `use_web_search`)

## Persona defaults

`persona.orion.default` — analytic, vouvoiement, `analytic-strict`.

## Golden paths / evals

Runtime: Orion task completes with `content` + `insights`. Skill golden under `skills/analysis`.
