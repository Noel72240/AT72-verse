# Skill: analysis

Phase 23 — reusable via `Kernel.skills.invoke` only.

## Purpose

Structured insights / competitive or data analysis.

## Input / Output

- Input: `brief` (+ optional `focus`, formality, rules, `use_web_search`)
- Output: `content`, `insights[]`, optional `sources`

## Required tools

Optional `web-search` when `use_web_search === true`.

## Consumers (agents)

Orion (explicit binding).

## Evals

`skills/analysis/src/evals/analysis.golden.test.ts`
