# Phase 25 — Pack de décisions (DS\*) — soumis PO

**Statut :** Accepted (PO 2026-07-19)  
**Date :** 2026-07-19  
**ADR-007 :** Accepted — Option A pgvector  
**Amendements PO :** score déterministe · résultats explicables (score, source, distance) · kill-switch sémantique · recherches vectorielles via Kernel.memory uniquement

---

## Contexte (état actuel)

- Memory Gateway = L1/L2 uniquement ; scopes `org.*` déjà déclarés dans les personas mais **refusés** par le Gateway.
- `forget` / `pin` / `link` → `UNAVAILABLE`.
- `Kernel.llm.embed` → `UNAVAILABLE` ; Cost Engine ne meter que `llm.complete`.
- UI `/memory` = **read-only**.
- Pulse = placeholder (Phase 27) — pas de persona.
- Table `memory_records` cascade sur delete org ; pas d’embeddings.

---

## Décisions à trancher

### DS1 — Périmètre de phase

**Proposition :** une Phase 25 unique couvrant :

1. Scopes L4 `org.brand` (+ alias `organization.brand` si besoin)
2. Embeddings + recall sémantique (pgvector si ADR-007-A)
3. `Kernel.memory.pin` pour brand facts
4. UI Memory Explorer **CRUD admin** (pas seulement lecture)

**Hors scope explicite :** L3 agent memory · L5 RAG/docs · Qdrant · Pulse agent complet · `link` · compaction / dedup sémantique avancée · summarize LLM.

---

### DS2 — Nommage des scopes L4

Personas utilisent déjà `org.brand` / `org.content`.

**Proposition :**

| Scope | Rôle P25 |
|-------|----------|
| `org.brand` | Faits de marque / tone of voice (lecture agents ; écriture admin + pin) |
| `org.content` | Contenu org partagé (Nova write déjà déclaré) — **supporté** si simple, sinon différé |

Recommandation : **activer `org.brand` en priorité** ; `org.content` en write/read si coût marginal faible, sinon P25b.

---

### DS3 — Chemin d’embedding

**Proposition :** activer `Kernel.llm.embed` (fin de UNAVAILABLE pour embed) :

- Gateway appelle embed **uniquement** via Kernel / ManagedLlmAdapter
- Cost Engine meter les embeddings (Rate Card versionnée) — **sans** changer la forme publique de `Kernel.cost.*` (mêmes méthodes, usage élargi)
- Stub déterministe pour CI (vecteurs dérivés du hash du texte)

Agents ne génèrent jamais d’embeddings eux-mêmes.

---

### DS4 — Indexation synchrone vs async

**Proposition MVP :** indexation **synchrone** au `remember` / pin / CRUD admin pour L4 (simplicité, tests déterministes).

Worker async (`apps/worker`) = phase ultérieure si volume.

---

### DS5 — Stratégie de recall

**Proposition :**

| Scope | Stratégie |
|-------|-----------|
| L1 / L2 (`run.working`, `conversation`, `user.*`) | Substring inchangé (Phase 18) |
| L4 (`org.brand`, …) | Recall **sémantique** (similarité) + tie-break déterministe (`created_at`, `id`) |

API `Kernel.memory.recall` inchangée ; le Gateway choisit la stratégie selon le scope.

---

### DS6 — `pin`

**Proposition :** implémenter `Kernel.memory.pin(id)` :

- Autorisé si persona `pin_policy = pin_brand_only` **et** record scope ∈ brand
- Adam (`pin_policy: none`) → FORBIDDEN
- Records pinnés prioritaires / non tombstonables par oubli automatique (pas de TTL auto en P25)

---

### DS7 — `forget` / CRUD admin

**Proposition :**

- Admin UI / API : soft-delete (**tombstone**) des records L4 (et embeddings associés)
- `Kernel.memory.forget` : activer en soft-delete pour agents **ou** rester UNAVAILABLE et réserver delete à l’API admin

**Recommandation :** activer `forget` soft pour agents (scopes write) + admin CRUD ; hard purge = delete org uniquement.

---

### DS8 — Memory Explorer CRUD

**Proposition :**

- Routes admin (RBAC `admin`+) : create / update / pin / tombstone sur `org.brand`
- Conserves GET read-only existants pour editors
- Pas d’éditeur graphique ; liste + formulaire simple

---

### DS9 — Preuve « Pulse/Nova »

Pulse n’existe pas encore (P27).

**Proposition :** golden test **Nova** lit `org.brand` (tone of voice) via `recall` et l’injecte dans `skill.writing`.  
Pulse : hors scope P25 (mention roadmap « Pulse/Nova » = critère assoupli à Nova-only jusqu’à P27).

---

### DS10 — Isolation & delete org

**Proposition :**

- Toute query vectorielle filtre `organization_id` (tests cross-tenant négatifs obligatoires)
- `deleteOrganization` cascade `memory_records` **et** `memory_embeddings`
- Aucun vecteur sans `organization_id`

---

### DS11 — Reproductibilité / snapshots

**Proposition :**

- Contenu L4 = source de vérité ; embeddings = dérivés (régénérables)
- Runs rejoués avec mêmes snapshots packages/grants/budget + même état mémoire org → même **ensemble** de recalls (ordre tie-break stable)
- Ne pas figer les vecteurs dans `packages_snapshot` / `grants_snapshot`

---

### DS12 — Hors scope (rappel)

Workflows · HITL · retries · providers image réels · L3 · L5 · Qdrant · Pulse full · `Kernel.memory.link` · summarize LLM · worker embeddings async.

---

## Contraintes héritées (post-J8 · post-J14)

- Agents → `Kernel.memory.*` only
- Vector store derrière Gateway / ports — pas d’accès DB direct
- `delegateMany` / `ask` inchangés par cette phase
- Nouveaux scopes = Gateway + Persona ; pas de hardcode agents dans Core
- Snapshots figés au Run restent la base de reproductibilité des capacités

---

## Critères de validation (si pack accepté)

1. Nova rappelle un fait `org.brand` pinné et l’utilise dans un draft
2. Recall sémantique L4 (stub embed OK en CI)
3. Delete org → 0 embeddings restants
4. Isolation tenant vectorielle (org A ne voit pas org B)
5. CRUD admin Memory Explorer sur brand facts
6. `pin` respecté selon `pin_policy`
7. L1/L2 substring non régressé
