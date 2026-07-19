# Memory Gateway (Phase 18 · 25)

## Objectif

Mémoire plateforme L1/L2 + **L4 org brand** via `Kernel.memory.*`, avec recall sémantique optionnel (ADR-007 pgvector).

## Architecture

```
Agents → Kernel.memory.{remember,recall,summarize,pin,forget}
              ↓
         MemoryGateway (Verse Core)
              ├─ PersonaEngine (read/write scopes · pin_policy)
              ├─ ConversationSummarizerPort
              ├─ MemoryStorePort (Postgres / in-memory)
              └─ VectorIndexPort (pgvector / in-memory)  ← jamais exposé au Kernel
```

- Les agents n’importent jamais `@at72-verse/db` ni un moteur vectoriel.
- Kill-switch : `VERSE_SEMANTIC_MEMORY=0` ou `setSemanticMemoryEnabled(false)` → fallback substring (`semantic_disabled_fallback`).
- Scores déterministes (6 décimales) · résultats explicables : `explanation.{strategy,score,distance,source}`.

## Scopes

| Scope | Couche | Binding |
|-------|--------|---------|
| `run.working` | L1 | `run_id` |
| `conversation` / `conversation.*` | L2 | `conversation_id` |
| `user` / `user.*` | L2 | `user_id` |
| `org.brand` / `org.content` | L4 | org (+ workspace stamp) |

## Recall

| Couche | Stratégie |
|--------|-----------|
| L1 / L2 | Substring (Phase 18) |
| L4 + query + semantic on | Cosine via VectorIndexPort |
| L4 + semantic off | Substring fallback |

## Pin / Forget

- `pin` : respect `pin_policy` (`pin_brand_only` → `org.brand` only)
- `forget` : soft-delete + suppression embedding
- Admin API : create / pin / forget brand facts (RBAC ADMIN)

## Embeddings

- `Kernel.llm.embed` activé (stub déterministe MVP) · Cost Engine meter
- Indexation synchrone au `remember` / `adminRemember` L4
- Embeddings dérivés (régénérables) — pas dans les snapshots Run

## API / UI

- GET memory (viewer) + POST/DELETE/pin admin sur `/workspaces/:id/memory`
- Web `/memory` — consultation + CRUD admin brand

## Hors scope

L3 · L5 · Qdrant · `link` · summarize LLM · worker async · Pulse full
