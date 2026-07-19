# Skill: image-generation

Phase 23 — reusable via `Kernel.skills.invoke` only.

## Purpose

Creative image brief / prompt. Optional stub image artifact.

## Input / Output

- Input: `brief`, optional style / aspect / `use_image_generate`
- Output: `content`, `prompt`, optional `artifact_id` / `url`

## Required tools

`image-generate` only when `use_image_generate === true` (grant disabled by default).

## Consumers (agents)

Pixel (explicit binding).

## Evals

`skills/image-generation/src/evals/image-generation.golden.test.ts`
