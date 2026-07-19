# Phase 16 — Demo checklist (3 minutes)

Sobriety-first UI: chat + RunSteps timeline. No token streaming.

## Prerequisites

1. Postgres up · `pnpm db:migrate`
2. `AUTH_PROVIDER=dev pnpm api:start` (port 3001)
3. `pnpm runtime:start` (Adam → Nova)
4. Optional: no `OPENAI_API_KEY` — Core noop / fake LLM still runs the path
5. `pnpm web:dev` (port 3000)

## Script

1. Open http://localhost:3000/login → DevAuth with any email → Continue  
2. Confirm Org / Workspace selectors populate (auto-creates Demo Org if empty)  
3. Send: `Rédige un post LinkedIn sur AT72 Verse`  
4. Watch timeline: Adam root → Nova child (`parent_step_id`) · active agent updates  
5. Assistant message appears when Run completes  
6. Refresh the page → conversation messages still present (CG1)  
7. (Optional) kill network briefly during a run → UI reconnects via REST snapshot + SSE  

## Failure path

Use a failing Nova registry or force agent error → Run `failed` · timeline shows failed steps · no silent hang.

## Smoke CI

```bash
pnpm --filter @at72-verse/web test:smoke
```

Does not require API or OpenAI (UI smoke only).
