# Architecture boundaries

**Phase 09** · Decisions **N3 · O3 · P2 · Q1 · R1**

This document defines the **invariants** that keep agents, skills, Kernel, and Core separated. Guards live in ESLint (`no-restricted-imports`) and dependency-cruiser; both must stay complementary.

## Invariants

| Zone | Rule |
|------|------|
| `agents/**`, `skills/**` | **Allow-list only** (P2, deny by default): `@at72-verse/contracts`, `@at72-verse/verse-kernel`, plus relative imports **within the same package** |
| `apps/api` → Core | Import **`@at72-verse/verse-core` package root only** — never deep paths / `packages/verse-core/src` (O3 · ADR-001) |
| `apps/agent-runtime` → Core | Same façade rule as API (Phase 13 / AR1); Runtime may host Core; never Prisma |
| `packages/verse-core` | **Never** import `agents/**` or `@at72-verse/agent-*` (O3) |
| `openai` SDK | **Only** inside `packages/verse-core` (Phase 13 / AS1 · AZ1) |

Any new dependency for agents/skills (or any exception) requires an **architecture decision** before it is allow-listed.

## Allowed vs forbidden examples

### Agents / skills — allowed

```ts
import type { KernelClient } from "@at72-verse/contracts";
import { createKernelClient } from "@at72-verse/verse-kernel";
import { localHelper } from "./helpers.js";
```

### Agents / skills — forbidden

```ts
import { createPrismaClient } from "@at72-verse/db"; // infra
import OpenAI from "openai"; // LLM SDK
import { createVerseCore } from "@at72-verse/verse-core"; // Core (use Kernel)
import { something } from "../../../packages/db/src/index.js"; // path escape
```

### API → Core — allowed

```ts
import { createVerseCore } from "@at72-verse/verse-core";
```

### API → Core — forbidden

```ts
import { VerseCore } from "@at72-verse/verse-core/src/facade/verse-core.js";
import { createNoopAdapters } from "../../../packages/verse-core/src/adapters/noop.js";
```

## Tooling

| Tool | Role | Command |
|------|------|---------|
| ESLint | Import statements in source | `pnpm lint` (via package lint scripts) |
| dependency-cruiser | Package / path dependency graph | `pnpm boundaries:depcruise` |
| Q1 fixture prove | Assert guards catch a known-bad import | `pnpm boundaries:prove` |

Combined: `pnpm boundaries` (depcruise + prove). Included in `pnpm ci`.

### Q1 fixture

`scripts/boundaries/fixtures/as-agent/intentional-violation.ts` is **not** production code. It is ignored by the main ESLint run and executed only by `boundaries:prove`, which **must** see a rejection (CI fails if the fixture passes).

## Known limitation (R1)

**Dynamic imports** (`import()`, `require` with computed strings, etc.) can bypass static ESLint / cruiser analysis.

- Documented as an accepted Phase 09 limit.
- Mitigations: PR review, later AST/ban rules if needed.
- Do not treat dynamic import as a supported escape hatch.

## Extending the allow-list

1. Submit an architecture decision (problem, options, recommendation).
2. After approval, update ESLint boundaries, `.dependency-cruiser.mjs`, this doc, and `docs/DECISIONS.md`.
3. Never silently add exceptions in a feature PR.
