# AT72 Verse — Roadmap de Développement

**Version :** 1.0  
**Statut :** Planification (pré-implémentation)  
**Date :** 18 juillet 2026  
**Référence architecture :** [`ARCHITECTURE.md`](./ARCHITECTURE.md) v2.0  
**Contrainte :** aucune implémentation dans ce document — planification uniquement

---

## 1. Objectif de ce document

Découper AT72 Verse en **phases de développement petites**, chacune :

- développable de façon isolée ;
- testable ;
- **validable avant** de passer à la suivante ;
- allant de la **première ligne de code** jusqu’à une **version SaaS commercialisable**.

### 1.1 Hypothèses d’estimation

| Paramètre | Hypothèse |
|-----------|-----------|
| Équipe de référence | 1–2 développeurs seniors full-stack TypeScript |
| Unité de complexité | **S** ≈ 1–3 j · **M** ≈ 4–7 j · **L** ≈ 8–15 j · **XL** ≈ 16–25 j |
| Jours = jours ouvrés person-days (pas calendaire) |
| Environnement | Dev local Docker dès Phase 03 ; staging cloud à partir de Phase 24 |
| ADR bloquants tranchés | **ADR-001 → ADR-006 Accepted (2026-07-18)** — Phase 01 autorisée |

Les estimations sont **relatives** : une équipe plus large réduit le calendrier, pas forcément la complexité intrinsèque.

### 1.2 Règles de passage de phase

Une phase est **Close** uniquement si :

1. les **critères de validation** sont verts ;
2. les tests automatisés prévus passent en CI ;
3. une **démo courte** (ou checklist écrite) est validée par le product owner ;
4. aucune dette bloquante n’est reportée sans ticket explicite.

### 1.3 Vue macro (jalons)

| Jalon | Phases | Livrable business |
|-------|--------|-------------------|
| **J0 — Foundations** | 01–06 | Monorepo, auth, org/workspace |
| **J1 — Kernel/Core** | 07–11 | Kernel + Core skeleton, boundaries |
| **J2 — First Run** | 12–16 | Premier chemin d’exécution agent (**atteint à P12**) · vertical slice LLM/Nova/stream (P13–16) |
| **J3 — Engines** | 17–22 | Socle LLM / providers (**atteint à P13**) · Persona, Skills, Memory, Tools, Costs (P14 / P17–22) |
| **J4 — Multi-agent** | 23–27 | Adam + Nova + Skills (**atteint à P14**) · délégation / chat (P15–16) · Squad + fan-out + workflow (P23–27) |
| **J5 — Platform** | 28–33 | Orchestration Adam→Nova + DAG Runs (**atteint à P15**) · UI chat (P16) · Catalogue / HITL / obs (P28–33) |
| **J6 — SaaS commercial** | 34–40 | First Run UX chat + vertical slice (**atteint à P16**) · Billing / onboarding / hardening / launch (P34–40) |
| **J7 — Persona Engine** | 17 | Identité agents configurable (**atteint à P17**) · Memory / Tools / Authz / Costs (P18–22) |
| **J8 — Memory Gateway** | 18 | Mémoire L1/L2 plateforme (**atteint à P18**) · Tools / Authz / Costs (P19–22) |
| **J9 — Tool Runtime** | 19 | Tools atomiques + audit (**atteint à P19**) · Authz / Costs (P20–22) |
| **J10 — Permissions** | 20 | Capability grants + Permission Engine (**atteint à P20**) · Costs (P21–22) |
| **J11 — Cost Engine** | 21 | Budgets run + Rate Card (**atteint à P21**) · Registry (P22) |
| **J12 — Package Registry** | 22 | Catalogue first-party + install/pin org (**atteint à P22**) |
| **J13 — Squad specialists** | 23 | Orion + Astra + Pixel (**atteint à P23**) |
| **J14 — Fan-out / Consult** | 24 | Parallel campaign + Ask/Consult (**atteint à P24**) |
| **J15 — Memory L4** | 25 | Org brand + embeddings (**atteint à P25**) |
| **J16 — First workflow** | 26 | Workflow déclaratif content-campaign (**atteint à P26**) |
| **J17 — Catalogue agents v1** | 27c | 12 agents catalogue (**atteint à P27c**) |

```
P01 ──► P06     Foundations
  └─► P07 ──► P11     Kernel / Core
        └─► P12 ──► P16     Vertical slice
              └─► P17 ──► P22     Engines
                    └─► P23 ──► P27     Multi-agent
                          └─► P28 ──► P33     Platform
                                └─► P34 ──► P40     Go-to-market
```

---

## 2. Phases détaillées

---

### Phase 01 — Bootstrap monorepo

| | |
|---|---|
| **Objectifs** | Initialiser le dépôt exécutable : workspaces, toolchains, CI vide mais verte. |
| **Fonctionnalités** | pnpm workspaces · Turborepo · apps/packages squelettes · ESLint/Prettier/TS strict · script `dev` no-op · README minimal · CI lint/typecheck |
| **Dépendances** | Architecture V2 validée · choix Node LTS |
| **Risques** | Sur-ingénierie du monorepo · configs conflictuelles |
| **Critères de validation** | `pnpm i` OK · `pnpm lint` + `pnpm typecheck` verts en CI · structure dossiers conforme ARCHITECTURE §10 |
| **Complexité** | **S** |
| **Statut** | **Validée (2026-07-18)** |

---

### Phase 02 — Contrats partagés (schemas)

| | |
|---|---|
| **Objectifs** | Figer les contrats TypeScript / JSON Schema sans runtime métier. |
| **Fonctionnalités** | `packages/contracts` : MessageEnvelope, AgentManifest, PersonaSpec, SkillSpec, ToolSpec, PackageManifest, Kernel API types (stubs) · versioning semver package |
| **Dépendances** | Phase 01 |
| **Risques** | Contrats trop rigides trop tôt · sur-modélisation |
| **Critères de validation** | Contrats compilent · exemples JSON valident contre schemas · revue archi « freeze v0 » |
| **Complexité** | **M** |
| **Statut** | **Validée (2026-07-18)** — contrats v0 = référence officielle |

---

### Phase 03 — Stack locale Docker

| | |
|---|---|
| **Objectifs** | Environnement local reproductible (data plane minimal). |
| **Fonctionnalités** | Docker Compose : PostgreSQL · Redis · (MinIO optionnel) · healthchecks · `.env.example` · docs runbook local |
| **Dépendances** | Phase 01 |
| **Risques** | Versions OS/Windows Docker · ports conflictuels |
| **Critères de validation** | `docker compose up` healthy en &lt; 2 min · connexion PG/Redis depuis host |
| **Complexité** | **S** |
| **Statut** | **Validée (2026-07-18)** — validation fonctionnelle locale Docker à confirmer par le PO sur machine de dev |

---

### Phase 04 — Schéma DB tenancy & Prisma

| | |
|---|---|
| **Objectifs** | Source de vérité relationnelle pour identité / org / workspace. |
| **Fonctionnalités** | `packages/db` · Prisma · tables `organizations`, `users`, `memberships`, `workspaces`, `workspace_members` · migrations · seed minimal |
| **Dépendances** | Phases 02, 03 |
| **Risques** | Modèle tenancy incomplet · migrations difficiles à faire évoluer |
| **Critères de validation** | Migrate + seed OK · requêtes CRUD unitaires · `organization_id` présent sur tables métier |
| **Complexité** | **M** |
| **Statut** | **Validée (2026-07-18)** — schéma tenancy v0 = référence plateforme |

---

### Phase 05 — Authentification

| | |
|---|---|
| **Objectifs** | Utilisateurs authentifiés de façon sécurisée (ADR-004 tranché). |
| **Fonctionnalités** | Signup / login / logout · sessions ou JWT · middleware auth API · protection routes · hashing passwords ou provider externe (Clerk/Auth0…) |
| **Dépendances** | Phase 04 · **ADR-004** |
| **Risques** | Choix auth difficile à migrer · faille session |
| **Critères de validation** | Parcours signup→login→accès route protégée · logout invalide la session · tests auth critiques verts |
| **Complexité** | **M** (Custom) / **S–M** (Clerk) |
| **Statut** | **Validée (2026-07-18)** — `packages/auth` = unique entrée auth ; RBAC ≠ auth |

---

### Phase 06 — Organisations, membres, workspaces

| | |
|---|---|
| **Objectifs** | Contexte multi-tenant utilisable par le reste de la plateforme. |
| **Fonctionnalités** | Création org · invitation membre · rôles owner/admin/editor/viewer · création workspace · switch workspace · isolation basique des requêtes |
| **Dépendances** | Phase 05 |
| **Risques** | Fuites cross-tenant · UX membership complexe |
| **Critères de validation** | User A ne voit pas org/workspace de User B · RBAC minimal enforce sur 3 endpoints · tests d’isolation |
| **Complexité** | **M** |
| **Statut** | **Validée (2026-07-18)** — Jalon J0 atteint ; `RbacService` = unique décision permissions |

**Jalon J0 atteint** : fondations produit non-IA prêtes.

---

### Phase 07 — Verse Kernel : contrat & client stub

| | |
|---|---|
| **Objectifs** | Définir la surface Kernel et un client injectable (sans vraie infra). |
| **Fonctionnalités** | `packages/verse-kernel` · interface syscalls (`llm`, `memory`, `tools`, `skills`, `orchestration`, `events`, `cost`…) · client stub / in-memory · erreurs normalisées · contexte `run_id` / `agent_id` |
| **Dépendances** | Phase 02 · **ADR-001, ADR-002** |
| **Risques** | API Kernel trop large · breaking changes futurs |
| **Critères de validation** | Un fake agent appelle le stub Kernel · tests contrat Kernel · doc liste des syscalls v0 |
| **Complexité** | **M** |
| **Statut** | **Validée (2026-07-18)** — Kernel = unique I/O agents↔infra ; StubKernelClient = référence tests/CI |

---

### Phase 08 — Verse Core : squelette & adapters no-op

| | |
|---|---|
| **Objectifs** | Faire exister Core comme cœur technique (embedded OK). |
| **Fonctionnalités** | Module Core · wiring adapters no-op/mock · health · injection depuis API · séparation claire Core ≠ Agent |
| **Dépendances** | Phase 07 |
| **Risques** | Core fourre-tout · couplage API↔Core |
| **Critères de validation** | API `/health/core` OK · aucun code « Adam » dans Core · diagramme modules reviewé |
| **Complexité** | **M** |
| **Statut** | **Validée (2026-07-18)** |

---

### Phase 09 — Boundary enforcement (CI)

| | |
|---|---|
| **Objectifs** | Empêcher structurellement les agents d’accéder à l’infra. |
| **Fonctionnalités** | Règles ESLint/dependency-cruiser : `agents/**` et `skills/**` n’importent ni `prisma`, ni SDK LLM, ni clients Redis · CI fail si violation |
| **Dépendances** | Phases 01, 07, 08 |
| **Risques** | Faux positifs · contournements dynamiques |
| **Critères de validation** | PR volontairement cassée rejetée par CI · doc « boundaries » |
| **Complexité** | **S** |
| **Statut** | **Validée (2026-07-18)** |

---

### Phase 10 — Bus d’événements minimal

| | |
|---|---|
| **Objectifs** | Pub/sub durable pour runs/tasks (ADR-003). |
| **Fonctionnalités** | Adapter bus (Redis Streams MVP ou NATS) · topics `runs.*` / `agent.*.tasks` · publish/subscribe · idempotency key basique |
| **Dépendances** | Phases 03, 08, 09 · **ADR-003** |
| **Risques** | Perte de messages · double traitement |
| **Critères de validation** | Message publié consommé 1 fois (idempotent) · test d’intégration bus · DLQ placeholder |
| **Complexité** | **M** |
| **Statut** | **Validée (2026-07-18)** |

---

### Phase 11 — Runs & RunSteps (persistance)

| | |
|---|---|
| **Objectifs** | Unité d’exécution tracée avant toute IA réelle. |
| **Fonctionnalités** | Tables `conversations`, `messages`, `runs`, `run_steps` · API create/get run · états `queued|running|completed|failed` · lien workspace/tenant |
| **Dépendances** | Phases 06, 08, 09, 10 |
| **Risques** | Modèle step trop pauvre/trop riche |
| **Critères de validation** | Créer un run manuel → steps visibles en DB/API · isolation tenant sur runs |
| **Complexité** | **M** |
| **Statut** | **Validée (2026-07-18)** |

**Jalon J1 atteint** : Kernel/Core/Bus/Runs prêts pour brancher des agents.

---

### Phase 12 — Agent Runtime + agent Adam (sans LLM)

| | |
|---|---|
| **Objectifs** | Exécuter Adam comme agent plugin via Kernel, avec logique déterministe. |
| **Fonctionnalités** | `apps/agent-runtime` · charge `agents/adam` · consomme `agent.adam.tasks` · handler stub qui crée un plan JSON fixe · émet `task.completed` · Kernel client réel (encore stub LLM) |
| **Dépendances** | Phases 07–11 |
| **Risques** | Confusion Adam/Core · runtime trop couplé |
| **Critères de validation** | Run déclenche Adam · step Adam `completed` · Adam n’importe aucune lib infra (CI) |
| **Complexité** | **M** |
| **Statut** | **Validée (2026-07-18)** |

**Jalon J2 atteint** (validation PO) : premier chemin d’exécution agent (Runtime natif + Adam + Bus + projections API).  
Les phases **13–16** poursuivent la vertical slice (LLM réel, Nova/skill, chat stream) sous les contraintes Runtime-only / Kernel+Bus.

---

### Phase 13 — Provider LLM réel + Model Profiles

| | |
|---|---|
| **Objectifs** | Premier appel LLM exclusivement via Kernel → Core. |
| **Fonctionnalités** | Adapter 1 provider (OpenAI ou Anthropic) · profiles `fast-cheap`, `orchestrate-precise` · `Kernel.llm.complete/stream` · metering tokens brut · secrets via env/vault local |
| **Dépendances** | Phase 08 · Phase 12 · clé API · **ADR-005** (BYOK plus tard OK) |
| **Risques** | Coûts surprises · latence · lock-in prompt · couplage Runtime↔Core |
| **Critères de validation** | Appel LLM uniquement via Kernel · fallback erreur provider propre · usage tokens enregistré · agents sans SDK LLM |
| **Complexité** | **M** |
| **Statut** | **Validée (2026-07-18)** |

**Jalon J3 atteint** (validation PO) : socle LLM (Core → Provider Adapter · Model Profiles · usage Bus→API).  
Les phases **14+** et **17–22** poursuivent Skill Engine / Persona / Memory / Tools / Costs sous les contraintes Kernel→Core→Adapter.

---

### Phase 14 — Skill `writing` + agent Nova

| | |
|---|---|
| **Objectifs** | Première skill réutilisable + premier agent spécialiste. |
| **Fonctionnalités** | Package `skills/writing` · `agents/nova` · binding Nova→writing · invocation `Kernel.skills.invoke` · input/output schemas · eval smoke (1 golden prompt) |
| **Dépendances** | Phases 12, 13 · **ADR-011** (à trancher) |
| **Risques** | Skill trop monolithique · qualité rédaction insuffisante · couplage Skill Engine |
| **Critères de validation** | Nova produit un texte via skill · skill n’a pas d’accès infra direct · schema output valide |
| **Complexité** | **L** |
| **Statut** | **Validée (2026-07-18)** |

**Jalon J4 atteint** (validation PO) : premier empilement multi-agent (Skills hybrides · `skill.writing` · Nova · `Kernel.skills.invoke` · Runtime SkillHost · Core sans deps Skills).  
Les phases **15–16** et **23–27** poursuivent délégation / chat / Squad sous les contraintes agents↔Skills découplées · Marketplace-ready · SkillSpec versionnable.

---

### Phase 15 — Délégation Adam → Nova (vertical slice)

| | |
|---|---|
| **Objectifs** | Boucle complète orchestration : utilisateur → Adam → Nova → synthèse. |
| **Fonctionnalités** | Adam planifie (LLM) · `orchestration.delegate` · Nova exécute · Adam agrège · run_steps DAG parent/enfant · gestion erreurs basique |
| **Dépendances** | Phases 12–14 |
| **Risques** | Boucles infinies · coûts · prompts instables |
| **Critères de validation** | Scénario « rédige un post LinkedIn » bout-en-bout · timeline steps Adam+Nova · échec Nova → run `failed` propre |
| **Complexité** | **L** |
| **Statut** | **Validée (2026-07-19)** |

**Jalon J5 atteint** (validation PO) : première orchestration multi-agent bout-en-bout (Adam→Nova · OrchestrationHost · DAG Runs · cascade d’échec).  
Les phases **16** et **28–33** poursuivent UI chat / plateforme sous les contraintes : pas de com. directe agents · délégation = OrchestrationHost only · même contrat pour futurs agents · API Host transparente pour Kernel.

---

### Phase 16 — UI Chat + streaming + timeline

| | |
|---|---|
| **Objectifs** | Première expérience utilisateur visible et démo-able. |
| **Fonctionnalités** | Next.js app auth · sélection workspace · chat · SSE/WS stream tokens & steps · timeline run · affichage agent actif (Adam/Nova) |
| **Dépendances** | Phases 05, 06, 15 |
| **Risques** | UX stream fragile · perf re-render |
| **Critères de validation** | Démo 3 minutes fluide · refresh reprend l’historique conversation · mobile lisible (basique) |
| **Complexité** | **L** |
| **Statut** | **Validée (2026-07-19)** |

**Jalon J6 atteint** (validation PO) : première expérience utilisateur démo-able (Next.js chat · SSE métier · timeline DAG · Conversation/Message/Run).  
Les phases **17–22** et **34–40** poursuivent engines / commercial sous les contraintes : Front → API only · pas de faux token stream · modèles Conversation/Message/Run · timeline = projection RunSteps · token stream = phase dédiée sans casser SSE métier.

---

### Phase 17 — Persona Engine (MVP)

| | |
|---|---|
| **Objectifs** | Configurer identité Nova/Adam sans changer le code agent. |
| **Fonctionnalités** | PersonaSpec stocké (ADR-010) · merge système→agent→org→workspace · `Kernel.persona.resolve` · UI édition ton/règles basique · preview |
| **Dépendances** | Phases 14, 16 · **ADR-010** |
| **Risques** | Merge conflictuel · personas trop verboses (tokens) |
| **Critères de validation** | Changer le tutoiement/vouvoiement sans redeploy agent · ResolvedPersona visible dans run debug |
| **Complexité** | **L** |
| **Statut** | **Validée (2026-07-19)** — Jalon **J7** atteint |

---

### Phase 18 — Memory L1 + L2

| | |
|---|---|
| **Objectifs** | Mémoire de run + conversation via Kernel. |
| **Fonctionnalités** | `Kernel.memory.remember/recall` · working memory run · résumé conversation simple · scopes + permission check minimal · UI memory read-only |
| **Dépendances** | Phases 11, 15 · **décisions DL\* Accepted** |
| **Risques** | Pollution contexte · fuites scope |
| **Critères de validation** | Nova relit un brief écrit par Adam dans `run.working` · user B ne recall pas mémoire user A |
| **Complexité** | **L** |
| **Statut** | **Validée (2026-07-19)** — Jalon **J8** atteint |

---

### Phase 19 — Tool Runtime + 2 tools read

| | |
|---|---|
| **Objectifs** | Premier tools atomiques exécutés via Core. |
| **Fonctionnalités** | ToolSpecs `web-search`, `file-read-write` (workspace files) · `Kernel.tools.execute` · audit log · allowlist · timeout |
| **Dépendances** | Phases 08, 14 · **décisions DM\* Accepted** |
| **Risques** | SSRF via web-search · abus file write |
| **Critères de validation** | Skill writing peut citer une source web · tool refusé si non grant · audit entry créée |
| **Complexité** | **L** |
| **Statut** | **Validée (2026-07-19)** — Jalon **J9** atteint |

---

### Phase 20 — Permissions agents / skills / tools

| | |
|---|---|
| **Objectifs** | Capability-based security exploitable. |
| **Fonctionnalités** | Grants DB · enforcement Kernel · enable/disable agent/skill/tool par workspace · UI admin basique · deny by default tools side-effect |
| **Dépendances** | Phases 06, 14, 19 · **décisions DN\* Accepted** |
| **Risques** | Modèle authz trop complexe · trous deny/allow |
| **Critères de validation** | Matrice de tests : 10 cas allow/deny documentés verts · tentative tool non autorisé → 403 Kernel |
| **Complexité** | **L** |
| **Statut** | **Validée (2026-07-19)** — Jalon **J10** atteint |

---

### Phase 21 — Cost Engine basique

| | |
|---|---|
| **Objectifs** | Budgets et coûts visibles par run. |
| **Fonctionnalités** | Ledger tokens/$ estimés · budget max par run · hard-stop Kernel si dépassé · affichage coût dans timeline UI |
| **Dépendances** | Phases 13, 15, 16, 20 · **décisions DO\* à valider** |
| **Risques** | Estimation $ imprécise · race conditions budget |
| **Critères de validation** | Run s’arrête au budget · coût affiché ± tolérance définie · usage_records persistés |
| **Complexité** | **M** |
| **Statut** | **Validée (2026-07-19)** — Jalon **J11** atteint |

---

### Phase 22 — Package Registry first-party (sans marketplace UI)

| | |
|---|---|
| **Objectifs** | Install/enable packages internes comme fondation marketplace. |
| **Fonctionnalités** | Tables packages/versions · register agents/skills/tools · `tenant_packages` · API list/install interne · version pin |
| **Dépendances** | Phases 02, 14, 19, 20, 21 · **décisions DP\* à valider** |
| **Risques** | Sur-design registry · migrations packages |
| **Critères de validation** | Désinstaller/reinstaller Nova via registry sans casser Core · versions listables |
| **Complexité** | **M** |
| **Statut** | **Validée (2026-07-19)** — Jalon **J12** atteint |

**Jalon J3 atteint — Engines** : fondations Persona/Memory/Tools/Authz/Cost/Registry (Registry = P22).

---

### Phase 23 — Agents Orion + Astra + Pixel

| | |
|---|---|
| **Objectifs** | Élargir la squad avec skills dédiées. |
| **Fonctionnalités** | Agents + personas + skills `analysis`, `seo`, `image-generation` · tools associés · bindings · evals smoke chacun |
| **Dépendances** | Phases 17–22 · **décisions DQ\* à valider** |
| **Risques** | Qualité inégale · explosion prompts |
| **Critères de validation** | Chaque agent complète 1 scénario golden · isolation permissions · pas d’import infra |
| **Complexité** | **XL** (peut être découpée en 23a/b/c si besoin) |
| **Statut** | **Validée (2026-07-19)** — Jalon **J13** atteint |

> **Sous-phases recommandées si capacité limitée :**  
> **23a** Orion+analysis (**L**) → **23b** Astra+seo (**L**) → **23c** Pixel+image (**L**)

---

### Phase 24 — Fan-out / Fan-in & Ask/Consult

| | |
|---|---|
| **Objectifs** | Collaboration multi-agents contrôlée. |
| **Fonctionnalités** | `delegateMany` · fan-in déterministe · `ask`/`can_consult` · mutex Cost Engine interne · timeline siblings |
| **Dépendances** | Phases 15, 23 · **DR1–DR10 Accepted** |
| **Risques** | Deadlocks · coûts parallèles · chaos consult |
| **Critères de validation** | Campagne « article + SEO review + visuel » en 1 run · consult refusé si hors policy · ordre résultats déterministe |
| **Complexité** | **L** |
| **Statut** | **Validée (2026-07-19)** — Jalon **J14** atteint |

> **Hors scope (DR10) :** workflows déclaratifs · HITL · retries automatiques · providers réels.  
> **Post-J14 :** `delegateMany` = primitive unique du fan-out · `ask` ≠ orchestration cachée · workflows futurs s’appuient sur ces primitives · nouveaux specialists sans modif Host · snapshots = reproductibilité.

---

### Phase 25 — Memory L4 (org brand) + embeddings

| | |
|---|---|
| **Objectifs** | Mémoire organisationnelle sémantique. |
| **Fonctionnalités** | Scopes `organization.*` / `org.*` · pgvector embeddings · recall sémantique · pin brand facts · UI Memory Explorer CRUD admin |
| **Dépendances** | Phase 18 · **ADR-007** · **décisions DS\* à valider** |
| **Risques** | Qualité embedding · coût indexation · PII |
| **Critères de validation** | Nova (et/ou Pulse) relit le tone of voice org · delete org efface embeddings · test isolation tenant vectoriel |
| **Complexité** | **L** |
| **Statut** | **Validée (2026-07-19)** — Jalon **J15** atteint |

> **Hors scope (DS12) :** L3 · L5 · Qdrant · Pulse full · `link` · summarize LLM · worker async.  
> **Post-J15 :** aucun accès métier direct à pgvector · sémantique via Kernel.memory only · swap moteur vectoriel sans toucher Agents/Skills · embeddings = dérivés · kill-switch = mode textuel seul.

---

### Phase 26 — Premier workflow déclaratif

| | |
|---|---|
| **Objectifs** | Exécuter un process métier hors chat libre. |
| **Fonctionnalités** | Workflow `content-campaign` · Workflow Engine Core · triggers manual · persistence `workflow_runs` · UI lancer/suivre |
| **Dépendances** | Phases 24, 22 · DT1–DT12 Accepted |
| **Risques** | Engine incomplet · reprise après crash |
| **Critères de validation** | Workflow rejouable · checkpoint → `waiting_checkpoint` + resume manuel · même bus que chat · pas de retry auto |
| **Complexité** | **L** |
| **Statut** | **Validée (2026-07-19)** — Jalon **J16** atteint |

> **Post-J16 :** Workflow Engine = orchestrateur Core uniquement (non-agent) · orch exclusive via `delegate` / `delegateMany` / `ask` · aucune Skill/Agent ne dépend du moteur · Agents portent toute l’intelligence métier · pas de retry automatique · reprise déterministe via checkpoint · futurs nœuds (condition, boucle, événement, attente, HITL…) via handlers sans remise en cause de l’architecture.

---

### Phase 27 — Catalogue agents restants (v1 partial)

| | |
|---|---|
| **Objectifs** | Couvrir Nyx, Pulse, Echo, Nexus, Vega, Neo, Kira (MVP capacités). |
| **Fonctionnalités** | Agents + personas + 1–2 skills chacun · tools critiques (`social-publish` dry-run, `gmb-sync` mock, `crm-sync` mock, etc.) · enablement par plan futur |
| **Dépendances** | Phases 23–26 |
| **Risques** | Scope creep · intégrations réelles trop tôt |
| **Critères de validation** | 12 agents listés/activables · 1 golden path chacun (même mocké) · registry coherent |
| **Complexité** | **XL** |
| **Statut** | **Validée (2026-07-19)** — 27a+27b+27c · **Jalon J17 atteint** · Catalogue agents v1 |

> **Sous-phases recommandées :**  
> **27a** Pulse+Echo (**L**) · **27b** Nexus+Vega (**L**) · **27c** Neo+Kira+Nyx (**L**)

> **Jalon (DU12) :** **J17 — Catalogue agents v1** — **atteint** à la validation PO de la livraison 27c.  
> **Post-J16 applicable :** Engine = orchestrateur only · Agents = métier · Skills indépendantes du moteur · handlers pour nœuds futurs.

---

### Phase 28 — Connecteurs OAuth réels (premier lot)

| | |
|---|---|
| **Objectifs** | Side-effects réels sur 1–2 intégrations prioritaires. |
| **Fonctionnalités** | OAuth connect/disconnect · vault secrets · tools `social-publish` et/ou `cms-publish` live · refresh tokens · revoke |
| **Dépendances** | Phases 19, 20, 27 · apps développeur chez providers |
| **Risques** | Quotas API tiers · security token leakage · UX OAuth |
| **Critères de validation** | Publication réelle sur compte test · revoke coupe l’accès · secrets absents des logs |
| **Complexité** | **XL** |
| **Statut** | **28a+28b validées PO (2026-07-19)** · Phase 28 clôturée · pack **P29** à valider avant code |

> **Sous-phases :**  
> **28a** SecretsVaultPort + OAuth LinkedIn + API/UI connexions (**0** publish live) · **28b** `social-publish` live LinkedIn (dual-mode · DY2-B)  
> Stop PO obligatoire entre 28a et 28b · OAuth confiné **API ↔ Core** uniquement.


---

### Phase 29 — HITL (Human-in-the-loop)

| | |
|---|---|
| **Objectifs** | Approuver les actions à risque avant exécution. |
| **Fonctionnalités** | `require_approval` grants · inbox UI · `POST /runs/:id/approve|reject` · timeout policy · audit |
| **Dépendances** | Phases 20, 28 |
| **Risques** | Runs bloqués · UX lente |
| **Critères de validation** | Publish social attend approve · reject annule sans side-effect · notification in-app |
| **Complexité** | **L** |
| **Statut** | **Validée PO (2026-07-19)** — HITL + DZ3bis + idempotence · **P30 = pack décisions dédié** (pas d’auto) |

---

### Phase 30 — Observabilité production-ready

| | |
|---|---|
| **Objectifs** | Traces, metrics, logs exploitables. |
| **Fonctionnalités** | OpenTelemetry · dashboards Grafana (ou équivalent) · correlation `run_id` · alertes erreur rate / DLQ · run debugger enrichi |
| **Dépendances** | Phases 15+, staging |
| **Risques** | Bruit de logs · PII dans spans |
| **Critères de validation** | 1 incident simulé diagnostiqué &lt; 15 min via traces · redaction PII vérifiée |
| **Complexité** | **L** |
| **Statut** | **Validée PO (2026-07-19)** — OTel + EA5bis + EA10bis · **P31 = pack décisions dédié** (pas d’auto) |

---

### Phase 31 — Quotas, plans techniques & rate limits

| | |
|---|---|
| **Objectifs** | Limiter l’abus avant la facturation Stripe. |
| **Fonctionnalités** | Plans `free/pro/enterprise` (flags) · quotas runs/tokens/agents · rate limit API · messages d’upgrade |
| **Dépendances** | Phases 21, 06 |
| **Risques** | Bypass quotas · UX frustrante |
| **Critères de validation** | Dépassement quota → erreur claire · admin peut ajuster quota tenant test |
| **Complexité** | **M** |
| **Statut** | **validée PO (2026-07-19)** — EB\* + EB3bis + EB7bis · **P32 = pack décisions dédié** |

---

### Phase 32 — Soft delete, audit trail, export RGPD basique

| | |
|---|---|
| **Objectifs** | Conformité minimale exploitations EU. |
| **Fonctionnalités** | Audit append-only · export données user/org · delete/anonymize account · retention policy config |
| **Dépendances** | Phases 06, 18, 30 |
| **Risques** | Incomplete delete (vectors/files) · charge légale |
| **Critères de validation** | Checklist RGPD interne 100 % · delete vérifié PG+S3+vector |
| **Complexité** | **L** |
| **Statut** | **validée PO (2026-07-19)** — EC\* + EC6bis + EC8bis + EC10bis · **P33 = pack décisions dédié** |

---

### Phase 33 — Hardening sécurité & pentest interne

| | |
|---|---|
| **Objectifs** | Corriger les classes de risques avant ouverture large. |
| **Fonctionnalités** | Threat model · revue Kernel chokepoint · tests IDOR · rate limit auth · headers sécurité · backup/restore DB documenté |
| **Dépendances** | Phases 20, 28–32 |
| **Risques** | Faux sentiment de sécurité · dettes non corrigées |
| **Critères de validation** | Rapport pentest interne sans critical ouvert · restore DB testé une fois |
| **Complexité** | **L** |

**Jalon J5 atteint — Platform** : plateforme beta sécurisée, multi-agents, intégrations réelles.

---

### Phase 34 — Billing Stripe & abonnements

| | |
|---|---|
| **Objectifs** | Monétiser (SaaS payant). |
| **Fonctionnalités** | Stripe Checkout/Customer Portal · webhooks · mapping plan→quotas · invoices · grace period · bloquage soft si unpaid |
| **Dépendances** | Phase 31 · compte Stripe |
| **Risques** | Webhooks ratés · fraude · fiscalité |
| **Critères de validation** | Parcours free→paid→cancel sur staging · quota mis à jour automatiquement · idempotence webhooks |
| **Complexité** | **L** |

---

### Phase 35 — Onboarding produit & empty states

| | |
|---|---|
| **Objectifs** | Réduire le time-to-value &lt; 10 minutes. |
| **Fonctionnalités** | Wizard org/workspace · activer Adam+Nova · exemple de prompt · checklist connecteurs · emails transactionnels de bienvenue |
| **Dépendances** | Phases 16, 34 |
| **Risques** | Onboarding trop long · drop-off |
| **Critères de validation** | Test utilisateur (5 personnes) : première valeur sans aide externe · funnel instrumenté |
| **Complexité** | **M** |

---

### Phase 36 — Admin console tenant + support tools

| | |
|---|---|
| **Objectifs** | Opérer les clients sans accès DB manuel. |
| **Fonctionnalités** | Vue usage · reset budget · impersonation contrôlée (auditée) · status agents · rejeu run (admin) · feature flags |
| **Dépendances** | Phases 30, 31, 34 |
| **Risques** | Impersonation abusive · surface admin large |
| **Critères de validation** | Support résout 5 tickets types sans SQL · chaque action admin auditée |
| **Complexité** | **L** |

---

### Phase 37 — Landing, pricing, docs publiques

| | |
|---|---|
| **Objectifs** | Surface marketing + documentation acheteur. |
| **Fonctionnalités** | Landing Next.js · page pricing · docs agents/skills · changelog · status page lien · SEO basique |
| **Dépendances** | Phase 35 (contenu) |
| **Risques** | Promesses marketing &gt; produit · SEO thin content |
| **Critères de validation** | Parcours visiteur→signup tracké · docs à jour avec catalogue réel |
| **Complexité** | **M** |

---

### Phase 38 — Staging → Production cloud

| | |
|---|---|
| **Objectifs** | Déploiement production fiable. |
| **Fonctionnalités** | Infra (K8s ou PaaS) · secrets manager · TLS · backups auto · migrations gated · blue/green ou rolling · monitoring uptime |
| **Dépendances** | Phases 03, 30, 33 · **IaC** |
| **Risques** | Downtime migrate · coûts cloud · config drift |
| **Critères de validation** | SLO upfront (ex. 99.5 %) · backup restore prod-like · runbook incident v1 |
| **Complexité** | **XL** |

---

### Phase 39 — Beta publique limitée & feedback loop

| | |
|---|---|
| **Objectifs** | Valider product-market fit sur un cohort contrôlé. |
| **Fonctionnalités** | Waitlist · invite codes · analytics produit · NPS in-app · triage bugs P0/P1 · weekly hardening |
| **Dépendances** | Phases 34–38 |
| **Risques** | Charge support · churn early · abus free tier |
| **Critères de validation** | N comptes actifs définis (ex. 20–50) · &lt; X P0 ouverts · rétention J7 mesurée |
| **Complexité** | **L** (calendaire souvent &gt; effort code) |

---

### Phase 40 — Go-to-market commercial (GA)

| | |
|---|---|
| **Objectifs** | Déclarer la **v1 SaaS commercialisable** (General Availability). |
| **Fonctionnalités** | Ouverture signup payant · SLA support email · CGU/politique confidentialité · facturation live · page status publique · kit vente (deck, demo script) · kill-switch feature flags |
| **Dépendances** | Phases 32–39 · validation légale/business |
| **Risques** | Sur-vente · incident J1 · non-conformité |
| **Critères de validation** | Checklist GA 100 % (annexe D) · premier paiement réel encaissé · postmortem template prêt · rollback testé |
| **Complexité** | **L** |

**Jalon J6 atteint — SaaS commercialisable.**

---

## 3. Phases post-GA (hors scope « commercialisable v1 », mais planifiées)

Ces phases **ne bloquent pas** le lancement commercial v1 ; elles prolongent la roadmap.

| Phase | Titre | Objectif | Complexité |
|-------|-------|----------|------------|
| 41 | Marketplace UI (5 catalogs) | Discovery/install packages tiers & first-party | XL |
| 42 | Signature packages & trust | Sigstore/cosign, review flow | L |
| 43 | Enterprise SSO/SCIM | Gros comptes | L–XL |
| 44 | Data residency multi-région | EU/US isolation | XL |
| 45 | Custom Agent/Skill Builder | No-code | XL |
| 46 | Evaluation Lab | Qualité continue agents/skills | L |
| 47 | Voice & multimodal studio | Différenciation | XL |
| 48 | On-prem / VPC | Régulé | XL |

---

## 4. Synthèse des complexités

| Jalon | Phases | Complexité cumulée (ordre de grandeur) |
|-------|--------|----------------------------------------|
| J0 Foundations | 01–06 | ~ **3–5 sem** |
| J1 Kernel/Core | 07–11 | ~ **3–5 sem** |
| J2 First Run | 12–16 | ~ **5–8 sem** |
| J3 Engines | 17–22 | ~ **6–9 sem** |
| J4 Multi-agent | 23–27 | ~ **8–14 sem** |
| J5 Platform | 28–33 | ~ **8–12 sem** |
| J6 Commercial | 34–40 | ~ **6–10 sem** |
| **Total → GA** | **01–40** | **~ 40–60 sem** person-time *(≈ 10–15 mois à 1,5 dev ; ≈ 6–9 mois à 3 devs seniors)* |

Les plages sont indicatives : intégrations OAuth (28) et cloud prod (38) varient fortement.

---

## 5. Dépendances critiques (chemin critique)

```
01 → 02 → 04 → 05 → 06
01 → 03 → 04
02 → 07 → 08 → 10 → 11 → 12 → 13 → 14 → 15 → 16
                 ↗                ↘
               09                  17 → 18 → 25
                                   19 → 20 → 28 → 29
                                   21 → 31 → 34
                        15 → 23 → 24 → 26 → 27
                        22 ────────────┘
16 + 34 → 35 → 37
30 + 33 → 38 → 39 → 40
```

**Chemin critique vers First Run (J2) :**  
`01→02→07→08→10→11→12→13→14→15→16` (+ `03→04→05→06` en parallèle dès que possible).

**Chemin critique vers GA :**  
First Run → Engines (20, 21) → Multi-agent (24, 27) → OAuth+HITL (28–29) → Hardening+Prod (33, 38) → Billing+Beta (34, 39) → **40**.

---

## 6. Risques transverses (tous jalons)

| Risque | Impact | Mitigation |
|--------|--------|------------|
| ADR non tranchés | Reprises coûteuses | Freeze ADR-001→006 avant Phase 07 |
| Coûts LLM | Burn cash | Cost Engine tôt (21), budgets hard |
| Scope creep agents | Retard J4 | Golden paths mockés avant connecteurs réels |
| Fuites multi-tenant | Mortel commercialement | Tests isolation dès Phase 06, renew chaque jalon |
| Contournement Kernel | Dette sécu | Phase 09 + revues PR |
| Sur-ingénierie marketplace | Retard GA | Registry only jusqu’à Phase 41 |
| Qualité agents | Churn beta | Evals smoke par agent + Evaluation Lab (46) |

---

## 7. Définition de « SaaS commercialisable » (GA)

La Phase 40 n’est close que si **tous** les points suivants sont vrais :

1. Signup + auth + org/workspace stables  
2. Chat Adam → délégation multi-agents (au moins Nova + 2 autres) en production  
3. Personas configurables · skills registry · tools avec au moins 1 connecteur réel  
4. HITL sur side-effects critiques  
5. Billing live (paiement réel) + quotas enforce  
6. Isolation tenant testée + export/delete RGPD  
7. Observabilité + backups + runbook incident  
8. Landing + pricing + CGU/privacy  
9. Support email avec SLA annoncé  
10. Aucun P0 ouvert ; P1 planifiés &lt; 2 sprints  

---

## Annexe D — Checklist GA (Phase 40)

- [ ] Production URL HTTPS  
- [ ] Staging miroir  
- [ ] Stripe live mode validé  
- [ ] Monitoring uptime + alertes on-call  
- [ ] Backups quotidiens + restore test &lt; 30 j  
- [ ] Rate limits auth & API  
- [ ] Secrets hors repo  
- [ ] CGU / Privacy / DPA draft  
- [ ] Status page  
- [ ] Docs onboarding à jour  
- [ ] Demo script commercial  
- [ ] Feature flags kill-switch agents/tools  
- [ ] Plan de communication lancement  

---

## Annexe E — Ordre de démarrage recommandé (Sprint 0)

1. Trancher **ADR-001 → ADR-006** (1–2 ateliers)  
2. Lancer **Phase 01** immédiatement après  
3. Paralléliser **Phase 03** avec **Phase 02**  
4. Ne pas commencer d’UI chat avant **Phase 11** (sinon jetable)  
5. Ne pas brancher OAuth réel avant **Phase 20** (permissions)

---

*Fin de la roadmap AT72 Verse v1.0 — Planification uniquement, aucune implémentation.*
