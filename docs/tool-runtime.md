# Tool Runtime (Phase 19)

## Objectif

Exécuter des Tools atomiques via `Kernel.tools.*` avec allowlist, timeout, validation Ajv et audit.

## Architecture

```
Agent / Skill → Kernel.tools.execute
                    ↓
              ToolRuntime (Verse Core)
                ├─ Persona.spec.tools ∩ Agent.tools_allowlist (deny by default)
                ├─ Ajv input/output
                ├─ timeout (ToolSpec.timeout_ms)
                ├─ ToolExecution audit (toutes tentatives)
                └─ ToolHostPort → Runtime registry → tools/*
```

- Core n’importe jamais `tools/*`.
- Nouveaux Tools = packages + enregistrement Runtime — **API Kernel.tools stable**.
- Grants DB / UI admin → **Phase 20 livrée** (`docs/permission-engine.md`) — `Kernel.tools.execute` inchangé.

## Catalogue MVP

| Tool | Side-effect | Notes |
|------|-------------|--------|
| `web-search` | non | `WebSearchPort` abstrait — pas de HTTP arbitraire (anti-SSRF) |
| `file-read-write` | oui | sandbox workspace, anti-`..` |

## skill.writing + Tools (DM11)

`use_web_search: true` doit être passé **explicitement** dans l’input Skill.  
Sans ce flag, aucun Tool n’est appelé.

## Audit

Table `tool_executions` : `execution_id`, org, workspace, `run_id`, `step_id`, `trace_id`, tool + version, status, durée, résumés.

API read-only :

- `GET /workspaces/:id/tool-executions`
- `GET /runs/:id/tool-executions`
