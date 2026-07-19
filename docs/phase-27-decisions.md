# Phase 27 — Pack de décisions (DU\*) — soumis PO

**Statut :** **Accepted (PO 2026-07-19)**  
**Amendements PO :**  
- Tools **dry-run only** (activés) — aucun live avant P28  
- `skill.translation` **différée**  
- Nyx = storyboard mock (27c)  
- Architecture stricte **Persona → Skills → Kernel → Tools** — aucune archi parallèle  

**Date :** 2026-07-19  
**Base de référence :** commit `8f82a9b` (Phase 26 / J16)  
**Contraintes permanentes applicables :** post-J13 · post-J14 · post-J15 · **post-J16**

**Implémentation :** **27a validée PO (2026-07-19)** · 27b pack soumis séparément · 27c **bloquée**.

---

## Objectif roadmap (rappel)

Couvrir les agents restants du catalogue v1 (**Nyx, Pulse, Echo, Nexus, Vega, Neo, Kira**) en **capacités MVP** :

- agents + personas + 1–2 skills chacun ;
- tools critiques en **mock / dry-run** (pas d’OAuth live — Phase 28) ;
- enablement via Package Registry + Grants (comme P22–P23) ;
- **1 golden path** par agent (même mocké) ;
- **12 agents** listés / activables (Adam + 11 specialists).

Complexité roadmap : **XL** — sous-phases recommandées 27a / 27b / 27c.

---

## Contexte (état actuel)

| Élément | État |
|---------|------|
| Agents opérationnels | Adam, Nova, Orion, Astra, Pixel |
| Agents placeholder (bootstrap P01) | Nyx, Pulse, Echo, Nexus, Vega, Neo, Kira — `status: placeholder` / export stub |
| Skills actives | `writing`, `analysis`, `seo`, `image-generation` |
| Skills absentes (citées ARCH) | `social-scheduling`, `local-presence`, `support-triage`, `crm-assist`, `translation` (placeholder) |
| Tools stubs P19/P23 | `web-search`, `file-read-write`, `seo-audit`, `image-generate` |
| Tools placeholder | `social-publish`, `gmb-sync`, `crm-sync`, `cms-publish`, `http-request` |
| Runtime registry | Import explicite des 5 agents ; Host dérive allow-list du registry (**post-J13**) |
| Adam allow-list actuelle | `nova`, `orion`, `astra`, `pixel` (+ workflow-engine) |
| Workflows | `content-campaign` (Nova\|Astra\|Pixel) — **sans** Pulse / Nyx |
| OAuth / side-effects réels | **Hors scope** → Phase 28 |
| HITL | **Hors scope** → Phase 29 |

**Invariants à respecter (non négociables en P27) :**

- Agents / Skills → `@at72-verse/contracts` + `@at72-verse/verse-kernel` only.
- Core ne importe jamais `agents/*`.
- **Workflow Engine** = orchestrateur only ; **aucune** Skill/Agent ne dépend du moteur (**post-J16**).
- Nouveau specialist **sans** modifier OrchestrationHost (registry Runtime only — **post-J13**).
- `delegateMany` = seul fan-out ; `ask` ≠ orchestration cachée (**post-J14**).
- Tools side-effect via Tool Runtime + grants ; pas d’appel provider hors Kernel.

---

## ADR — évaluation

| ADR | Pertinence P27 | Action |
|-----|----------------|--------|
| **ADR-006** Runtime natif | Modèle agent = `handleTask` + registry | **Réutiliser** — pas de framework tiers |
| **ADR-001–005** | Boundaries Core/Kernel/Bus/Auth/LLM | Inchangés |
| **ADR-007** Vector | Vega/Pulse peuvent *lire* `org.brand` ; pas de nouveau moteur | Inchangé |
| **ADR-011** Skills hybrides | Nouvelles skills = SkillSpec + `execute` | **Réutiliser** |
| **Nouvel ADR ?** | Pas de changement de fondation (pas de nouveau runtime, bus, store, modèle d’orchestration) | **Proposition : aucun ADR nouveau** |

**Recommandation :** P27 = **extension catalogue** suivant le modèle P23 (DQ\*), documentée dans ce pack DU\* + entrée DECISIONS.  
Un ADR ne serait requis que si on changeait par ex. le modèle de plugin agent, le chargement dynamique hors registry Runtime, ou l’introduction d’un second moteur d’orchestration — **hors proposition**.

---

## Décisions à trancher

### DU1 — Découpage de phase (monolithe vs sous-phases)

| Option | Description | Avantages | Risques |
|--------|-------------|-----------|---------|
| **A** | Une Phase 27 unique (7 agents) | Un seul jalon produit | Scope creep · revue PO difficile · XL réel |
| **B** | **27a / 27b / 27c** (roadmap) | Validation incrémentale · arrêt possible entre lots | 3 packs / 3 stops |
| **C** | 27 = Pulse seul ; reste reporté | Focus social | Catalogue v1 incomplet longtemps |

**Proposition :** **Option B**

| Sous-phase | Agents | Thème | Complexité |
|------------|--------|-------|------------|
| **27a** | Pulse, Echo | Distribution locale & social | L |
| **27b** | Nexus, Vega | Automatisation & veille | L |
| **27c** | Neo, Kira, Nyx | Commerce, support, vidéo | L |

Chaque sous-phase : décisions DU\* déjà Accepted + **validation PO** avant la suivante.  
Implémentation **interdite** tant que DU\* (ce pack) non Accepted ; ensuite 27a peut démarrer sans re-ouvrir tout le catalogue.

**Recommandation :** **B**.

---

### DU2 — Profondeur MVP par agent (« v1 partial »)

**Proposition :** pour chaque agent, le MVP = **surface complète plateforme** + **logique métier mince** :

| Livrable | Obligatoire |
|----------|-------------|
| Package `pkg.<agent>` + seed Registry | Oui |
| Persona default versionnée | Oui |
| 1 skill primaire (invoke Kernel) | Oui |
| 0–1 skill secondaire (reuse ou mince) | Optionnel |
| 0–1 tool mock/dry-run si critique domaine | Oui si side-effect domaine |
| `handleTask` + plan déterministe | Oui |
| Grant default + packages_snapshot | Oui |
| Golden path Runtime (tests) | Oui |
| Qualité LLM production / prompts riches | Non (smoke OK) |
| Intégration OAuth / API tier réelle | Non → P28 |
| Workflow dédié | Non (sauf DU10) |

**Alternative :** agents « façade » sans skill (plan only) — **rejetée** (casse post-J4 / Skill reuse).

**Recommandation :** MVP = P23-parity (Orion/Astra/Pixel), pas plus.

---

### DU3 — Matrice agents → skills → tools (bindings explicites)

**Proposition de bindings MVP :**

| Agent | Rôle | Skill(s) primaire | Skill reuse | Tool(s) P27 | Mode tool |
|-------|------|-------------------|-------------|-------------|-----------|
| **Pulse** | Social | `skill.social-scheduling` (**nouvelle**) | `skill.writing` (opt-in) | `social-publish` | **dry-run** (payload + audit, pas d’API réseau) |
| **Echo** | Google Business / local | `skill.local-presence` (**nouvelle**) | — | `gmb-sync` | **mock** (réponse figée déterministe) |
| **Nexus** | Automatisations | `skill.automation-plan` (**nouvelle**, nom à figer) | — | `http-request` | **dry-run** (URL/méthode validés, **aucun** fetch réel) |
| **Vega** | Veille | `skill.watch-brief` (**nouvelle**) | `skill.analysis` (opt-in) | `web-search` | Stub existant (P19) |
| **Neo** | Commercial / CRM | `skill.crm-assist` (**nouvelle**) | `skill.writing` (opt-in) | `crm-sync` | **mock** |
| **Kira** | Support | `skill.support-triage` (**nouvelle**) | `skill.writing` (opt-in) | — | FAQ via LLM only en MVP |
| **Nyx** | Vidéo | `skill.video-brief` (**nouvelle** : script / storyboard) | — | `video-pipeline` (**nouveau stub**) ou report tool | **mock** storyboard JSON — **pas** de rendu vidéo |

**Alternatives nommage skills :**

- Réutiliser uniquement `writing` / `analysis` sans skills domaine → **rejetée** (ARCH + marketplace-ready exigent skills domaine).
- Une mega-skill par agent inline → **rejetée** (anti Skill reuse).

**Recommandation :** tableau ci-dessus ; ids skills stables `skill.*` ; packages `pkg.skill.*`.

---

### DU4 — Tools : mock vs dry-run vs live

| Mode | Définition | Usage P27 |
|------|------------|-----------|
| **mock** | Réponse synthétique déterministe, aucun I/O externe | `gmb-sync`, `crm-sync`, `video-pipeline` |
| **dry-run** | Valide input, produit un *intent* audité (`would_publish`, `would_request`), **zéro** side-effect réseau | `social-publish`, `http-request` |
| **live** | Appel provider réel | **Interdit** en P27 → Phase 28 |

**Proposition :**

- Aucun tool P27 n’appelle un SaaS tiers.
- `side_effect: true` dans ToolSpec **conservé** pour les tools qui seront live plus tard — Permission Engine + grants s’appliquent déjà (DN\*).
- Grants defaults : dry-run/mock **enabled: true** pour first-party (sauf politique plus stricte PO).

**Alternative :** tools disabled by default jusqu’à P28 — plus sûr, UX catalogue moins démontrable.  
**Recommandation :** **enabled: true** en mock/dry-run + message clair dans le résultat (`mode: "dry_run"|"mock"`).

---

### DU5 — Extensibilité Runtime / Adam (post-J13)

**Proposition (alignée P23) :**

1. Enregistrer chaque nouvel agent dans le **Runtime agent registry** (`apps/agent-runtime`) uniquement.
2. **Ne pas** modifier OrchestrationHost pour hardcoder des ids — allow-list dérivée du registry (+ table declarative si déjà le cas).
3. Étendre la allow-list Adam (et `workflow-engine` si besoin) via la **même** source declarative Runtime :
   - Pulse, Echo, Nexus, Vega, Neo, Kira, Nyx = déléguables depth 1 depuis Adam.
4. Packages : seeds `FIRST_PARTY_PACKAGE_SEEDS` + permissions `orchestration.delegate:<id>` sur Adam.
5. Grants : `FIRST_PARTY_CAPABILITY_DEFAULTS` étendu.

**Interdit :**

- Modifier Verse Core pour un 6ᵉ–12ᵉ agent.
- Faire dépendre un agent du Workflow Engine.
- Introduire un chargement dynamique filesystem/marketplace en P27.

**Recommandation :** strict clone du modèle DQ (P23).

---

### DU6 — Graphe `can_consult` / `ask` (post-J14)

Éviter un graphe complet 7×7 (bruit + tests).

**Proposition minimale :**

| From | can_consult (P27) | Motivation |
|------|-------------------|------------|
| Pulse | Nova, Astra | copy / SEO avant post |
| Echo | Astra | local SEO |
| Vega | Orion | approfondir insight |
| Neo | Nova | offre / copy |
| Kira | Neo | handoff lead (consult, pas delegate nested) |
| Nyx | Nova, Pixel | script + visuel |
| Nexus | — (aucun en MVP) | reste planificateur / dry-run |

- `ask` reste consultation (pas de depth++, lock nested orch).
- Pas de fan-out nouveau obligatoire entre les 7 (sauf scénario test optionnel).

**Alternative :** aucun `can_consult` en P27 — plus simple, moins fidèle ARCH handoffs.  
**Recommandation :** graphe minimal ci-dessus.

---

### DU7 — Personas & Model Profiles

**Proposition :**

- 1 fichier `personas/persona.<agent>.default.json` par agent (comme Orion/Astra/Pixel).
- Scopes mémoire : lire `run.working` ; lire `org.brand` si pertinent (Pulse, Nyx, Neo, Nova-like) — **écriture L4** réservée admin (post-J15).
- Model profiles : réutiliser existants (`creative`, `analytic-strict`, …) — **pas** de nouveau profil sauf besoin explicite Nyx/Vega.
- Formality / tone via Persona Engine (P17) — pas de hardcode agent.

**Recommandation :** 0 nouveau Model Profile en P27a ; réévaluer en 27c pour Nyx si storyboard exige un profil dédié (soumettre avant code).

---

### DU8 — Seed Package Registry & enablement « par plan »

Roadmap mentionne « enablement par plan futur ».

| Option | Comportement |
|--------|--------------|
| **A** | Tous les 7 packages **installés + grants enabled** par défaut (comme squad P23) |
| **B** | Installés mais **grants disabled** sauf Pulse (démo progressive) |
| **C** | Modèle `plan` / entitlements dès P27 |

**Proposition :** **Option A** — catalogue démontrable ; le gating commercial (plans Stripe) = Phases 31 / 34+.  
Documenter que Package Registry + Grants **sont** le mécanisme d’enablement futur (pas un second système).

**Recommandation :** **A**.

---

### DU9 — `skill.translation`

| Option | Choix |
|--------|-------|
| **A** | Livrer `skill.translation` MVP en P27 (Nova/Pulse/Kira) |
| **B** | **Différer** — agents multilingues via consignes Persona + `writing` |
| **C** | Stub package only sans golden |

**Proposition :** **B** — réduit XL ; translation = phase ultérieure ou 27c option si capacité.  
**Recommandation :** **B** (hors scope P27 sauf amendement PO).

---

### DU10 — Workflows & catalogue

| Option | Contenu |
|--------|---------|
| **A** | Aucun nouveau workflow — agents utilisables via Adam chat / delegate |
| **B** | Étendre `content-campaign` avec Pulse (après checkpoint) |
| **C** | Nouveau workflow `local-seo-boost` (Astra+Echo+Nova) — placeholder existe |

**Proposition :** **A** en P27a–b ; **C optionnel en 27c** seulement si golden agents stables — sinon Phase dédiée / P28+.  
Respect **post-J16** : si workflow ajouté, Engine reste sans métier ; steps = `delegate` / `fan_out` / `checkpoint` existants ; agents portent l’intelligence.

**Recommandation :** **A** (focus catalogue agents) ; workflows additionnels = décision séparée soumise avant code.

---

### DU11 — Surface API / UI

**Proposition MVP :**

| Surface | P27 |
|---------|-----|
| Runtime + tests golden | Oui |
| Package Registry UI `/packages` | Liste les nouveaux pkgs (déjà générique) |
| Grants UI `/grants` | Enable/disable nouveaux agents (générique) |
| Chat Adam | Délégation naturelle si allow-list + intents |
| Nouvelle page catalogue agents | **Non** (hors scope) |
| Nouveaux endpoints métier par agent | **Non** |

**Recommandation :** pas de console agents dédiée en P27.

---

### DU12 — Critères de validation & jalon

**Critères PO (phase / sous-phase) :**

1. Les agents du lot sont **installables / listés** (Registry) et **activables** (Grants).
2. Chaque agent du lot : **1 golden path Runtime** vert (même mocké).
3. Aucun import infra dans `agents/*` / `skills/*` (Kernel only).
4. Tools critiques : mode `mock` ou `dry_run` explicite — **zéro** appel réseau tiers.
5. Nouveau specialist ajouté **sans** modifier OrchestrationHost / Core.
6. Aucune dépendance Skill/Agent → Workflow Engine.
7. À la fin de **27c** : **12 agents** catalogue (Adam + 11) cohérents Registry/Personas/Grants/Runtime.

**Jalon :**

| Option | Libellé |
|--------|---------|
| **A** | Pas de nouveau numéro — clôture narrative **J4 Multi-agent** (catalogue v1) |
| **B** | Nouveau **J17 — Catalogue agents v1** (plus clair opérationnellement) |

**Proposition :** **B — J17** (les jalons J13–J16 sont atomiques ; J4 reste macro historique).  
**Recommandation :** **B**.

---

### DU13 — Hors scope explicite (gel)

- OAuth / vault secrets / publish live / GMB live / CRM live → **P28**
- HITL approve/reject → **P29**
- Marketplace UI / signatures packages → plus tard
- `skill.translation` (sauf amendement) → DU9-B
- Rendu vidéo réel / FFmpeg / providers vidéo → post-P27
- Nexus triggers planifiés / workers jobs → post-P27 (Nexus = plan + dry-run only)
- Nouveaux nœuds Workflow Engine (condition, loop, HITL) → phases ultérieures via handlers
- Billing / plans commerciaux → P31+
- Évals LLM qualitatives poussées → smoke only

---

## Impacts (si pack Accepted)

| Zone | Impact |
|------|--------|
| `agents/{pulse,echo,nexus,vega,neo,kira,nyx}` | `handleTask` réel (fin placeholder) |
| `skills/*` | 5–6 nouvelles skills domaine |
| `tools/*` | Impl mock/dry-run + évent. `video-pipeline` stub |
| `personas/*` | 7 personas default |
| `packages/contracts` | Seeds packages + grants + éventuellement permissions Adam |
| `apps/agent-runtime` | Registry + tests golden (pas Host rewrite) |
| Core / Kernel / Workflow Engine | **Aucun** changement de contrat d’orch attendu |
| Docs | ROADMAP statut · CHANGELOG · packages-matrix · DECISIONS |

**Risque principal :** scope creep tools « presque live ». Mitigation = DU4 + DU13.

---

## Ordre d’implémentation proposé (après Accept)

```text
Accept DU* ──► 27a Pulse+Echo ──► stop PO
                 └─► 27b Nexus+Vega ──► stop PO
                       └─► 27c Neo+Kira+Nyx ──► stop PO · J17
```

Aucune sous-phase ne démarre sans validation PO de la précédente.  
**Phase 28 non lancée** automatiquement après 27c.

---

## Synthèse des recommandations

| ID | Recommandation |
|----|----------------|
| DU1 | Sous-phases **27a / 27b / 27c** |
| DU2 | MVP = parité P23 (golden mocké) |
| DU3 | Bindings skills/tools tableau §DU3 |
| DU4 | Tools **mock/dry-run only** ; live = P28 |
| DU5 | Registry Runtime only ; pas de modif Core/Host |
| DU6 | `can_consult` minimal |
| DU7 | Personas default ; pas de nouveau Model Profile en 27a |
| DU8 | Seeds installés + grants enabled (A) |
| DU9 | `translation` différé |
| DU10 | Pas de nouveau workflow en P27 (A) |
| DU11 | Pas de nouvelle UI catalogue |
| DU12 | Critères golden × N + **Jalon J17** |
| DU13 | Hors scope gelé (OAuth, HITL, vidéo réelle, …) |
| ADR | **Aucun nouvel ADR** — extension catalogue sous ADR-006 / P23 |

---

## Questions PO (à trancher)

1. Confirmes-tu **DU1-B** (27a→27b→27c) plutôt qu’une seule Phase 27 monolithe ?
2. Confirmes-tu **DU4** (dry-run/mock enabled by default) vs grants disabled jusqu’à P28 ?
3. Confirmes-tu **DU10-A** (pas de nouveau workflow) ou souhaites-tu `local-seo-boost` / Pulse dans content-campaign dès 27a ?
4. Confirmes-tu **DU12-B** (jalon **J17**) ?
5. Confirmes-tu **DU9-B** (pas de `skill.translation` en P27) ?
6. Nyx : OK pour MVP **script/storyboard mock** sans pipeline vidéo réel ?

---

## Prochaine étape

- **Attendre Accept (évent. amendé) de DU1–DU13.**
- Puis uniquement soumettre / lancer **27a** — pas de code avant validation.
- Aucune Phase 28 tant que non demandé + pack dédié.
