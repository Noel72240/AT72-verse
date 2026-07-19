# @at72-verse/contracts

Shared **TypeScript types** and **JSON Schemas** for AT72 Verse (**freeze v0** — Phase 02).

## Scope

| Contract | TS | JSON Schema | Example |
|----------|----|-------------|---------|
| `BusMessage` / `MessageEnvelope` | yes | `schemas/bus-message.schema.json` | `examples/bus-message.task-completed.json` |
| `AgentManifest` | yes | `schemas/agent-manifest.schema.json` | `examples/agent-manifest.nova.json` |
| `PersonaSpec` | yes | `schemas/persona-spec.schema.json` | `examples/persona-spec.nova.default.json` |
| `SkillSpec` | yes | `schemas/skill-spec.schema.json` | `examples/skill-spec.writing.json` |
| `ToolSpec` | yes | `schemas/tool-spec.schema.json` | `examples/tool-spec.seo-audit.json` |
| `PackageManifest` | yes | `schemas/package-manifest.schema.json` | `examples/package-manifest.nova.json` |
| `KernelClient` (+ Bus API types) | stubs | — | — |

Aligned with ARCHITECTURE.md and ADR-001→006. No business runtime.

## Commands

```bash
pnpm --filter @at72-verse/contracts typecheck
pnpm --filter @at72-verse/contracts lint
pnpm --filter @at72-verse/contracts test
pnpm --filter @at72-verse/contracts validate:examples
```

Package version **0.1.1** = freeze v0 + additive `KernelContext` fields (Phase 07). Breaking contract changes require a semver bump and changelog entry.

## Public internal API policy (post Phase 02 validation)

These contracts are the **official reference** for subsequent phases:

- Treat all exported types and JSON Schemas as **public internal APIs**.
- **Incompatible** changes require a **new semver version** and an explicit justification (CHANGELOG; ADR if architectural).
- Implementations **adapt to contracts**, never the reverse.
- Schema validation tests remain **mandatory in CI**.
- JSON examples under `examples/` are **conformance references** and must stay in sync with schemas.
