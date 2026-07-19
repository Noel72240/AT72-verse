# Agent: Pixel

Design / image specialist (Phase 23).

## Role

Image brief via `skill.image-generation`. Side-effect tool `image-generate` only when explicitly requested (`use_image_generate`) and grant enabled.

## Skills

- `skill.image-generation` (binding explicite)

## Tools

- `image-generate` (stub, side-effect, grant disabled by default)

## Persona defaults

`persona.pixel.default` — creative, tutoiement, `creative-balanced`.

## Golden paths / evals

Runtime: Pixel task completes with `content` + `prompt` without calling the side-effect tool by default.
