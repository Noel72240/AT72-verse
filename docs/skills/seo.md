# Skill: seo

Phase 23 — reusable via `Kernel.skills.invoke` only.

## Purpose

SEO audit synthesis + recommendations.

## Input / Output

- Input: `brief`, optional `url`, formality, rules, `use_web_search`
- Output: `content`, `score`, `recommendations[]`, `findings[]`

## Required tools

- `seo-audit` (always)
- optional `web-search`

## Consumers (agents)

Astra (explicit binding).

## Evals

`skills/seo/src/evals/seo.golden.test.ts`
