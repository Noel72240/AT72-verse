# Decisions Log

Index of architecture and product decisions.

Formal ADRs live in `docs/ADR/`.

| ID | Title | Status | Date |
|----|-------|--------|------|
| — | Architecture V2 validated | Accepted | 2026-07-18 |
| — | Roadmap V1 validated | Accepted | 2026-07-18 |
| [ADR-001](./ADR/001-verse-core-embedded-with-facade.md) | Verse Core embarqué + façade publique (Option C) | Accepted | 2026-07-18 |
| [ADR-002](./ADR/002-verse-kernel-library-transparent-transport.md) | Kernel library + transport transparent (Option A) | Accepted | 2026-07-18 |
| [ADR-003](./ADR/003-event-bus-redis-streams-abstracted.md) | Bus Redis Streams + API générique + events versionnés (Option A) | Accepted | 2026-07-18 |
| [ADR-004](./ADR/004-auth-clerk-idp-abstraction.md) | Clerk IdP + `packages/auth` abstrait + RBAC Verse séparé (Option B) | Accepted | 2026-07-18 |
| [ADR-005](./ADR/005-llm-byok-ready-credential-resolver.md) | BYOK-ready + Credential Resolver hiérarchique ; BYOK off au MVP (Option C) | Accepted | 2026-07-18 |
| [ADR-006](./ADR/006-verse-native-agent-runtime.md) | Runtime agents Verse natif + interfaces ; pas de framework externe (Option C) | Accepted | 2026-07-18 |
| — | Contracts freeze v0 (`@at72-verse/contracts@0.1.0`) = API publiques internes officielles ; breaking → nouvelle version + justification ; implémentations s’adaptent aux contrats ; tests schémas obligatoires en CI ; exemples JSON = références de conformité | Accepted | 2026-07-18 |
| — | Phase 04 tenancy impl. notes : UUID PK · rôles P06 en schéma · `clerk_user_id` (ADR-004) · RLS différée · `organization_id` sur `workspace_members` | Accepted | 2026-07-18 |
| — | Schéma données tenancy v0 = référence plateforme ; breaking → migration + justification ; Prisma = SoT domaine ; logique métier hors Prisma (Core/services) | Accepted | 2026-07-18 |
| — | Phase 05 A: dual adapter `AuthProvider` + Clerk + Dev ; `AUTH_PROVIDER` ; pas d’import `@clerk/*` hors adapter | Accepted | 2026-07-18 |
| — | Phase 05 B: lazy upsert user (idempotent) + webhook Clerk stub | Accepted | 2026-07-18 |
| — | Phase 05 C: NestJS auth API sans Next.js / `@clerk/nextjs` | Accepted | 2026-07-18 |
| — | `packages/auth` = unique point d’entrée auth ; pas d’import Clerk hors adapter ; DevAuthAdapter maintenu pour CI ; RBAC = Phase 06 uniquement | Accepted | 2026-07-18 |
| — | Phase 06 D1: invitations (token unique, expiry, PENDING/ACCEPTED/EXPIRED/REVOKED, réémission avec historique) | Accepted | 2026-07-18 |
| — | Phase 06 E1: workspace actif = choix client ; vérif membership + appartenance org ; pas de confiance header seul | Accepted | 2026-07-18 |
| — | Phase 06 F: surface API tenancy + `RbacService` unique ; Controller→AuthGuard→RbacGuard→Service→Prisma ; rôles OWNER>ADMIN>EDITOR>VIEWER | Accepted | 2026-07-18 |
| — | Jalon J0 atteint (Phases 01–06) ; `RbacService` = unique point de décision permissions ; pas de logique permission dans controllers | Accepted | 2026-07-18 |
| — | Phase 07 G1: Kernel réexporte contrats uniquement (pas de duplication de types) | Accepted | 2026-07-18 |
| — | Phase 07 H1: StubKernelClient déterministe + historique d’appels ; transport opaque | Accepted | 2026-07-18 |
| — | Phase 07 I: contexte auto-injecté (run/trace/span/agent/org/workspace/user) + instrumentation interne sans changer l’API Kernel | Accepted | 2026-07-18 |
| — | Verse Kernel = unique I/O agents↔infra ; StubKernelClient = référence tests/CI ; nouvelles capacités via Kernel d’abord | Accepted | 2026-07-18 |
| — | Phase 08 J1: toute logique Core dans `packages/verse-core` ; API n’importe que `@at72-verse/verse-core` (ADR-001) | Accepted | 2026-07-18 |
| — | Phase 08 K: façade minimale ; Core = orchestrateur de modules ; adapters no-op sur interfaces définitives | Accepted | 2026-07-18 |
| — | Phase 08 L2: dual backend Kernel `stub` (CI) / `core` (démo in-process) ; opaque pour agents ; `VERSE_KERNEL_BACKEND` | Accepted | 2026-07-18 |
| — | Phase 08 M: `GET /health/core` + `health()` structuré extensible (status, modules, adapters, backend, version, uptime) | Accepted | 2026-07-18 |
| — | Core = runtime host Verse ; agents externes via Kernel uniquement ; aucun import Adam/agent dans `verse-core` | Accepted | 2026-07-18 |
| — | Phase 08 validée ; Core = point central d’orchestration ; agents → Kernel only ; apps → façade Core only ; providers via adapters | Accepted | 2026-07-18 |
| — | Phase 09 N3: ESLint + dependency-cruiser complémentaires | Accepted | 2026-07-18 |
| — | Phase 09 O3: invariants agents/skills allow-list · API façade Core · Core sans agents | Accepted | 2026-07-18 |
| — | Phase 09 P2: deny-by-default ; seuls `contracts` + `verse-kernel` ; exceptions via décision d’archi | Accepted | 2026-07-18 |
| — | Phase 09 Q1: fixture de violation isolée + job `boundaries:prove` | Accepted | 2026-07-18 |
| — | Phase 09 R1: imports dynamiques = limite connue documentée dans `docs/boundaries.md` | Accepted | 2026-07-18 |
| — | Phase 09 validée ; frontiers = invariants ; pas d’exception locale ; allow-list évolue avec l’archi | Accepted | 2026-07-18 |
| — | Phase 10 S1: `@at72-verse/bus` = unique impl Bus ; Core délègue via BusAdapter | Accepted | 2026-07-18 |
| — | Phase 10 T2: publish+subscribe réels ; request/broadcast stubs `UNAVAILABLE` | Accepted | 2026-07-18 |
| — | Phase 10 U2: topics `verse.runs.*` / `verse.agent.{id}.tasks` + préfixes réservés system/audit/metrics | Accepted | 2026-07-18 |
| — | Phase 10 V1: idempotence `event_id` par consommateur | Accepted | 2026-07-18 |
| — | Phase 10 W1: DLQ placeholder `verse.dlq` (même enveloppe BusMessage) | Accepted | 2026-07-18 |
| — | Phase 10 X2: InMemory (unit) + Redis Streams (intégration) ; parité fonctionnelle | Accepted | 2026-07-18 |
| — | Phase 10 Y1: Redis uniquement dans `@at72-verse/bus` ; boundaries P09 inchangées | Accepted | 2026-07-18 |
| — | Phase 10 Z1: Bus câblé comme provider Core | Accepted | 2026-07-18 |
| — | Phase 10 validée ; Bus = seule infra événements ; pas d’accès Redis métier ; versioning events ; adapters futurs sans changer métier ; opaque agents | Accepted | 2026-07-18 |
| — | Phase 11 AA1–AH1 : runs schema strict · conversation nullable · parent_step_id · 4 états · API services · PATCH technique · bus verse.runs.* · contracts 0.1.2 | Accepted | 2026-07-18 |
| — | Phase 11 validée ; Jalon J1 atteint ; Runs = unité d’exécution ; agents → Run ; RunStep = seules étapes ; pas de modèle parallèle ; bus → run_id | Accepted | 2026-07-18 |
| — | Phase 12 AI3–AQ1 : runtime événementiel · dispatch Adam · handleTask · Kernel stub · process long-lived · projection API · boundaries strictes | Accepted | 2026-07-18 |
| — | Phase 12 validée ; Jalon J2 atteint (premier chemin d’exécution agent) ; Runtime = unique moteur d’exécution agents ; agents = modèle Adam ; Adam ≠ dépendance Runtime/Core ; projections = API only ; capacités agents via Kernel+Bus | Accepted | 2026-07-18 |
| — | Phase 13 AR1–AZ1 : Runtime host Core · OpenAI adapter · profiles fast-cheap/orchestrate-precise · complete réel / stream UNAVAILABLE · credentials env platform · usage Bus→API · preuve hors Adam · erreurs normalisées · SDK confiné | Accepted | 2026-07-18 |
| — | Phase 13 validée ; Jalon J3 atteint (socle LLM) ; agents sans SDK LLM ; intelligence = Kernel→Core→Adapter ; providers = adapters only ; Model Profiles = seule sélection modèle ; verse.llm.usage = métrologie officielle | Accepted | 2026-07-18 |
| — | Phase 14 BA2–BL1 : Skills hybrides · Runtime skill registry · Nova=Adam model · writing+LLM · creative-balanced · Ajv · Runs dispatch · boundaries strictes · ADR-011 Accepted | Accepted | 2026-07-18 |
| — | Phase 14 validée ; Jalon J4 atteint (Adam+Nova+Skills) ; agents orchestrent Skills sans réimplémenter ; Skills indépendantes des agents / Marketplace-ready ; SkillSpec versionnable ; capacité métier = Skill avant agent ; Marketplace sans modif Core | Accepted | 2026-07-18 |
| — | Phase 15 BM1–BX1 Accepted : Adam LLM plan (orchestrate-precise) · delegate await · OrchestrationHostPort Runtime · in-process Nova (API remote-ready) · DAG parent_step_id · fail cascade · pass-through · depth=1 · allow-list adam→nova · tests happy+fail ; propagate run_id/trace_id/parent_step_id · record délégation avant exécution | Accepted | 2026-07-19 |
| — | Phase 15 validée ; Jalon J5 atteint (orchestration Adam→Nova + DAG) ; OrchestrationHost = point unique de délégation ; Kernel.orchestration.delegate only ; agents découplés ; DAG Runs = représentation officielle ; pas de com. directe agents ; futur Host distribué = même API | Accepted | 2026-07-19 |
| — | Phase 16 CA1–CK1 Accepted : Next.js 15 App Router · DevAuth · front→API only · Conversation→Message→Run · SSE métier (pas de tokens) · timeline DAG · message assistant persisté · sélecteur org/ws · agent actif depuis steps · UX chat-first · Playwright+checklist · SSE reconnectable · état = APIs only | Accepted | 2026-07-19 |
| — | Phase 16 validée ; Jalon J6 atteint (First Run UX) ; Front → API only · Conversation/Message/Run · pas de faux token stream · timeline = projection RunSteps · token stream phase dédiée sans casser SSE métier | Accepted | 2026-07-19 |
| — | Phase 17 DA1–DK1 + ADR-010 : Persona Engine MVP (hybride · Core · ResolvedPersona · merge system→agent→org→workspace · Kernel.resolve · stamp Runtime · attach RunStep · UI workspace · seeds adam/nova · tests) | **Accepted** | 2026-07-19 |
| — | Phase 17 validée ; Jalon **J7** atteint (Persona Engine) ; aucune Persona métier hardcodée dans agents ; Persona Engine = source officielle comportement configurable ; Personas découplées des Skills ; futures couches (User/Run/Session) sans casser merge ; resolve via Kernel only ; nouvelles capacités comportementales → Persona Engine | Accepted | 2026-07-19 |
| — | Phase 18 DL1–DL13 (+ amendement DL8) : Memory L1/L2 · Postgres · MemoryGateway Core · Persona scopes · Adam→Nova run.working · recall substring · summarize via ConversationSummarizerPort · forget/pin/link UNAVAILABLE · UI read-only · ADR-007 reste Proposed · id stable · trace run_id/trace_id · store vector-ready sans changer Kernel.memory | **Accepted** | 2026-07-19 |
| — | Phase 18 validée ; Jalon **J8** atteint (Memory Gateway) ; Kernel.memory only ; vectoriel futur derrière Gateway ; pas d’accès métier direct au store ; L3–L5 sans rupture de compatibilité | Accepted | 2026-07-19 |
| — | Phase 19 DM1–DM13 (+ amendement DM11) : ToolRuntime Core · ToolHostPort · hybride ToolSpec+execute · web-search+file-read-write · Persona∩Agent allowlist · WebSearchPort anti-SSRF · sandbox FS · audit tool_executions · timeout · Ajv · use_web_search explicite · API read-only · execution_id + step_id · ToolSpec.version · Kernel.tools API stable | **Accepted** | 2026-07-19 |
| — | Phase 19 validée ; Jalon **J9** atteint (Tool Runtime) ; Tools via ToolHostPort+registry ; Kernel.tools only ; Grants P20 enrichissent sans changer `Kernel.tools.execute` ; connecteurs futurs = même modèle ToolSpec+execute | Accepted | 2026-07-19 |
| — | Phase 20 DN1–DN13 Accepted : Permission Engine Core · PermissionGrant générique · capability_grants SoT · composition Persona∩allowlist∩grant∩side-effect · deny-by-default side-effect · skills/agents gated · grants_snapshot figé · engine unique · UI enable/disable · RBAC≠capabilities · seeds DN12 · matrice tests · reasons explicites · extensible sans changer Kernel APIs | **Accepted** | 2026-07-19 |
| — | Phase 20 validée ; Jalon **J10** atteint (Permissions) ; toute capacité → Permission Engine only · politiques futures enrichissent le moteur sans changer APIs Kernel · grants_snapshot = SoT audit/rejeu · authz déterministe/explicable/auditable | Accepted | 2026-07-19 |
| — | Phase 21 DO1–DO13 Accepted (DO3a) : Cost Engine Core · LLM-only metering · llm_usages SoT (agrégats à la lecture) · budget run · budget_snapshot figé · hard-stop unique · Rate Card versionnée · Kernel.cost API stable · timeline coût · déterminisme · hors billing | **Accepted** | 2026-07-19 |
| — | Phase 21 validée ; Jalon **J11** atteint (Cost Engine) ; Tools/connectors → Cost Engine sans changer Kernel.cost · billing s’appuie sur le moteur · Rate Card versionnée · agrégats dérivés de llm_usages | Accepted | 2026-07-19 |
| — | Phase 22 DP1–DP14 Accepted (+ DP12b) : Registry unique multi-kind · metadata only (pas de load dynamique) · Registry≠Install≠Permissions · tables packages/versions/tenant_packages · install org / enable Grants · seeds first-party · pin obligatoire · APIs catalog/install/uninstall/pin · DP9 uninstall Nova · grants seedés seulement · Kernel.registry read · UI /packages · hors marketplace/signatures · soft uninstall sans cascade Runs/memory/audit · package_id immuable · PackageVersion immuable après publish | **Accepted** | 2026-07-19 |
| — | Phase 22 validée ; Jalon **J12** atteint (Package Registry) ; Marketplace réutilise ce Registry · chargeur dynamique sans changer Kernel.registry · signatures/tiers enrichissent le modèle · packages_snapshot = reproductibilité/rejeu | Accepted | 2026-07-19 |
| — | Phase 23 DQ1–DQ11 Accepted : squad Orion/Astra/Pixel · bindings explicites · tools stubs seo-audit/image-generate · Registry/Grants/Personas comme Nova · allow-list Adam multi-specialists depth=1 · hors fan-out/consult · profils déclaratifs · golden smokes · contraintes extensibilité Runtime-only | **Accepted** | 2026-07-19 |
| — | Phase 23 validée ; Jalon **J13** atteint (Squad specialists) ; nouveau specialist sans modifier OrchestrationHost · modèle Package+Persona+Skill+Grants · providers image = stub only · Cost Engine mesure LLM · packages_snapshot/grants_snapshot figés au Run | Accepted | 2026-07-19 |
| — | Phase 24 DR1–DR10 Accepted (+ amendement DR8 mutex Cost Engine interne) : delegateMany · fan-in déterministe sans polish · campagne Nova+Astra+Pixel · all-or-nothing · ask≠delegate (pas de depth) · can_consult+package+grant · Host générique · timeline siblings · hors workflows/HITL · ordre résultats déterministe · ask sans orchestration · événements traçables | **Accepted** | 2026-07-19 |
| — | Phase 24 validée ; Jalon **J14** atteint (Fan-out / Consult) ; post-J14 : `delegateMany` = fan-out unique · `ask` ≠ orch cachée · workflows futurs sur ces primitives · Host générique pour nouveaux specialists · snapshots = reproductibilité | Accepted | 2026-07-19 |
| — | Phase 25 DS1–DS12 Accepted (+ contraintes : score déterministe · résultats explicables score/source/distance · kill-switch sémantique · vector search via Kernel.memory only) | **Accepted** | 2026-07-19 |
| — | Phase 25 validée ; Jalon **J15** atteint (Memory L4) ; post-J15 : pas d’accès métier à pgvector · sémantique via Kernel.memory only · swap moteur vectoriel sans Agents/Skills · embeddings = dérivés · kill-switch = textuel seul | Accepted | 2026-07-19 |
| — | Phase 26 DT1–DT12 Accepted (+ amendement DT6 : checkpoints · resume manuel · états `paused`/`waiting_checkpoint` · **pas** de retry auto · Engine sans logique métier · nœuds futurs extensibles) | **Accepted** | 2026-07-19 |
| — | Phase 26 validée ; Jalon **J16** atteint (First workflow) ; post-J16 : Engine = orchestrateur Core only · aucune Skill/Agent ne dépend du moteur · Agents = intelligence métier · futurs nœuds (condition/boucle/événement/attente/HITL) via handlers sans remise en cause | Accepted | 2026-07-19 |
| — | Phase 27 DU1–DU13 Accepted (+ tools dry-run only · translation différée · Nyx storyboard mock · Persona→Skills→Kernel→Tools strict · sous-phases 27a→27b→27c · J17) · 27a en cours | **Accepted** | 2026-07-19 |
| — | Phase **27a validée** (Pulse+Echo) ; dry-run only · Registry = enregistrement unique · pas de logique métier Runtime/Core/Host · **J17 non atteint** · 27b pack à valider avant code | Accepted | 2026-07-19 |
| — | Phase 27b pack DV1–DV9 **soumis PO** (`docs/phase-27b-decisions.md`) — Nexus+Vega · http-request dry-run · watch-brief · **pas d’implémentation** · pas de 27c | Proposed | 2026-07-19 |
| — | Phase 27b DV1–DV9 Accepted (+ Vega consult Orion · http-request dry-run grant · web-search défaut on · Nexus plan-only) · 27b en cours | **Accepted** | 2026-07-19 |
| — | Phase **27b validée** (Nexus+Vega) ; dry-run déterministe · Registry unique · pas de logique métier Runtime/Core/Host · **J17 non atteint** · 27c pack à valider avant code | Accepted | 2026-07-19 |
| — | Phase 27c pack DW1–DW9 **soumis PO** (`docs/phase-27c-decisions.md`) — Neo+Kira+Nyx · crm-sync/video-pipeline dry-run · storyboard · **J17 après validation livraison** · **pas d’implémentation** · pas de P28 auto | Proposed | 2026-07-19 |
| — | Phase 27c DW1–DW9 Accepted (+ dry-run crm/video · Kira sans tool · golden Kira→Neo consult · video-brief/video-pipeline · J17 post-livraison) · 27c en cours | **Accepted** | 2026-07-19 |
| — | Phase **27c validée** (Neo+Kira+Nyx) ; Catalogue agents v1 ; dry-run déterministe · Registry unique · pas de logique métier Runtime/Core/Host · **Jalon J17 atteint** · P28 pack à valider avant code | Accepted | 2026-07-19 |
| — | Phase 28 pack DX1–DX13 **soumis PO** (`docs/phase-28-decisions.md`) — orientations PO DX2/3/4/5/8 (+ contraintes vault/dry-run) · **validation finale en attente** · **pas de commit docs** · **pas d’implémentation** · ADR-013 après Accept · pas de P29 auto | Proposed | 2026-07-19 |
| — | Phase 28 DX1–DX13 **Accepted** (+ amendement **DX13-B** : sous-phases **28a** vault/OAuth/API-UI → **28b** social-publish live LinkedIn) · contraintes plaintext éphémère · dry-run défaut · **ADR-013 Proposed** · **pas d’implémentation** tant que ADR non validé · pas de P29 auto | **Accepted** | 2026-07-19 |
| — | Phase 28 + **ADR-013 Accepted** (+ OAuth confiné API↔Core · aucune donnée OAuth Agents/Skills/Runtime/Host) · **28a en cours** · 28b bloquée · pas de P29 auto | **Accepted** | 2026-07-19 |
| — | Phase **28a livrée** (Vault + OAuth LinkedIn + API/UI) — attente validation PO ; social-publish dry-run only · **28b bloquée** · pas de P29 auto | Accepted | 2026-07-19 |
| — | Phase **28a validée** (Vault + OAuth LinkedIn + API/UI) ; plaintext jamais persisté · OAuth API↔Core only · social-publish dry-run · Kernel public inchangé · **28b pack dédié avant code** · pas de P29 | Accepted | 2026-07-19 |
| — | Phase 28b pack DY1–DY9 **soumis PO** (`docs/phase-28b-decisions.md`) — social-publish live LinkedIn · dual-mode · token resolve Core · **pas d’implémentation** · pas de P29 auto | Proposed | 2026-07-19 |
| — | Phase 28b DY1–DY9 **Accepted** (+ amendement **DY2-B** : `CONNECTOR_NOT_CONNECTED` si live sans connexion · pas de fallback dry-run silencieux) · 28b en cours · pas de P29 auto | **Accepted** | 2026-07-19 |
| — | Phase **28b livrée** (social-publish live LinkedIn) — attente validation PO ; CONNECTOR_NOT_CONNECTED · token Core only · Kernel.tools inchangé · **pas de P29** | Accepted | 2026-07-19 |
| — | Phase **28b validée** (social-publish live LinkedIn) ; DY2-B CONNECTOR_NOT_CONNECTED · token Core only · Kernel.tools inchangé · Phase 28 clôturée · **P29 pack avant code** | Accepted | 2026-07-19 |
| — | Phase 29 HITL **validée PO** (+ DZ3bis · reprise idempotente) — ApprovalRequest · waiting_approval · ToolRuntime gate · inbox · claim unique · Kernel.tools stable · **P30 = pack dédié** | Accepted | 2026-07-19 |
| — | Phase 30 observabilité **validée PO** (+ EA5bis · EA10bis &lt;5%) — `@at72-verse/observability` · Prometheus · OTLP optionnel · compose · debugger · **P31 = pack dédié** | Accepted | 2026-07-19 |
| — | Phase 31 quotas **validée PO** (+ EB3bis · EB7bis) — plans numériques · quotas org · Redis RPM · audit overrides · `/quotas` · **P32 = pack dédié** | Accepted | 2026-07-19 |
| — | Phase 32 soft delete / audit / export RGPD **validée PO** (+ EC6bis · EC8bis · EC10bis) — `audit_events` · exports · `/privacy` · 410 · **P33 = pack dédié** | Accepted | 2026-07-19 |
| [ADR-013](./ADR/013-tenant-secrets-vault-oauth-connectors.md) | Tenant Secrets Vault + OAuth Connectors (LinkedIn · dual-mode · 28a/28b · OAuth API↔Core only) | **Accepted** | 2026-07-19 |
| [ADR-007](./ADR/007-vector-store-pgvector.md) | Vector store — pgvector MVP derrière MemoryStorePort / VectorIndexPort (Option A) ; Kernel indépendant du moteur | **Accepted** | 2026-07-19 |
| ADR-008 | GraphQL for console | Proposed | — |
| ADR-009 | Polyglot Python runtime | Proposed | — |
| ADR-010 | Persona storage (hybride first-party + org/workspace DB) | **Accepted** | 2026-07-19 |
| ADR-011 | Skills : code vs déclaratif | **Accepted — hybride** (SkillSpec + `execute`) · `docs/ADR/011-skills-hybrid.md` | Accepted | 2026-07-18 |
| ADR-012 | Package signatures | Proposed | — |
