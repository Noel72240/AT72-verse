# Phase 27c — Pack de décisions (DW\*) — soumis PO

**Statut :** **Accepted (PO 2026-07-19)** — livraison **validée PO**  
**Amendements PO :** dry-run crm/video · Kira sans tool · golden consult Kira→Neo · ids video-brief/video-pipeline · **J17 uniquement après validation livraison 27c**  
**Date :** 2026-07-19  
**Prérequis :** Phase **27b validée** (commit `2c1bca5`) · DU\* / DV\* Accepted  
**Lot :** **Neo + Kira + Nyx** uniquement  
**Jalon J17 :** **atteint** (validation PO livraison 27c — 2026-07-19)  
**Implémentation :** **27c validée PO** · Catalogue agents v1 · **P28 = pack dédié uniquement** (pas d’auto-enchaînement)

---

## Objectif

Clôturer le catalogue agents v1 avec les 3 spécialistes restants :

| Agent | Domaine |
|-------|---------|
| **Neo** | Commercial / CRM — assist pipeline & offres |
| **Kira** | Support client — triage tickets / FAQ |
| **Nyx** | Vidéo — **script / storyboard mock** uniquement (pas de rendu) |

Même modèle que 27a/27b : **Persona → Skills → Kernel → Tools** · **Runtime Agent Registry only** · dry-run / stub **déterministe**.

---

## Contexte (post-27b)

| Élément | État |
|---------|------|
| Agents opérationnels | Adam, Nova, Orion, Astra, Pixel, Pulse, Echo, Nexus, Vega |
| Neo / Kira / Nyx | Placeholders P01 |
| Tool `crm-sync` | Placeholder bootstrap |
| Tool `video-pipeline` | **Absent** — à créer en stub dry-run/mock |
| Skills `crm-assist`, `support-triage`, `video-brief` | Absentes |
| `skill.translation` | **Différée** (DU9 Accepted) |
| Workflows | Aucun nouveau en P27 (DU10) |
| Contraintes | Zéro service tiers réel · dry-run déterministe · Registry = enregistrement unique |

**Catalogue cible après 27c (12) :** Adam + Nova + Orion + Astra + Pixel + Pulse + Echo + Nexus + Vega + **Neo + Kira + Nyx**.

---

## ADR

Aucun nouvel ADR. Extension catalogue sous **ADR-006** + modèle 27a/27b.

---

## Décisions à trancher

### DW1 — Périmètre strict 27c

**Proposition :** livrer **uniquement** Neo + Kira + Nyx :

1. Packages / grants / Adam `orchestration.delegate:*`
2. Personas default
3. Skills domaine + bindings
4. Tools dry-run déterministes (`crm-sync`, `video-pipeline`)
5. Runtime registry + 3 golden tests
6. Docs + assertion catalogue 12 agents installables
7. **J17** déclaré atteint **seulement** après Accept PO de la livraison 27c

**Hors scope 27c :** Phase 28 OAuth · workflows · translation · rendu vidéo réel · HITL · UI catalogue dédiée.

**Recommandation :** accepter DW1.

---

### DW2 — Bindings Neo / Kira / Nyx

**Proposition (alignée DU3 + amendements dry-run 27a/27b) :**

| Agent | Skill primaire | Skill reuse | Tool | Mode |
|-------|----------------|-------------|------|------|
| **Neo** | `skill.crm-assist` (**nouvelle**) | `skill.writing` **opt-in** (flag) | `crm-sync` | **dry-run** (`would_sync`, déterministe) |
| **Kira** | `skill.support-triage` (**nouvelle**) | `skill.writing` **opt-in** (flag) | — | LLM + plan triage ; **pas** de tool obligatoire |
| **Nyx** | `skill.video-brief` (**nouvelle**) | — | `video-pipeline` (**nouveau**) | **dry-run / storyboard** (`mode: "dry_run"`, `would_render: false`, JSON storyboard) |

**Alternatives Kira + tool :**

| Option | Choix |
|--------|-------|
| **A** | Aucun tool (recommandé — triage cognitif) |
| **B** | Tool `ticket-classify` stub | Sur-engineering P27 |
| **C** | Réutiliser `crm-sync` | Couplage support↔CRM prématuré |

**Recommandation :** tableau + Kira **A**.

---

### DW3 — `crm-sync` dry-run (contrat)

**Proposition :** activer le package existant en **dry-run déterministe** (pas de mock alternatif — cohérence 27a/27b) :

```json
{
  "mode": "dry_run",
  "would_sync": true,
  "object_type": "lead",
  "operation": "upsert",
  "record_preview": { "…" }
}
```

- Aucun appel réseau CRM.
- Grant **enabled: true** (dry-run only).
- Golden Neo : `dry_run.would_sync === true`.

**Recommandation :** accepter DW3.

---

### DW4 — `video-pipeline` storyboard (Nyx)

**Proposition (PO : Nyx = storyboard mock) :**

- Nouveau tool `video-pipeline` :
  - Input : `brief`, optionnel `format` / `duration_s`
  - Output déterministe :

```json
{
  "mode": "dry_run",
  "would_render": false,
  "storyboard": [
    { "shot": 1, "description": "…" },
    { "shot": 2, "description": "…" }
  ],
  "script_outline": "…"
}
```

- **Interdit :** FFmpeg, providers vidéo, upload S3, fichiers binaires.
- Skill `video-brief` : LLM structure le brief + appelle le tool pour matérialiser le storyboard JSON.
- Golden Nyx : `would_render === false` + `storyboard.length >= 1` + content non vide.

**Alternative :** pas de tool, storyboard uniquement dans l’output skill — moins traçable Tool Runtime.  
**Recommandation :** tool stub + skill (chaîne Persona→Skills→Kernel→Tools intacte).

---

### DW5 — `can_consult` (DU6)

| From | can_consult | Motivation |
|------|-------------|------------|
| **Neo** | `["nova"]` | copy / offre |
| **Kira** | `["neo"]` | handoff lead (consult, pas delegate nested) |
| **Nyx** | `["nova", "pixel"]` | script + visuel |

- `ask` reste consultation (pas de depth++, lock nested).
- Pas de golden consult obligatoire en 27c (smoke allow-list suffit) — **sauf** si PO exige un test `task.consulted`.

**Proposition test :** 1 test unitaire/runtime optionnel Kira→Neo consult **ou** assertion `can_consult` registry only.  
**Recommandation :** registry `can_consult` + **1** golden consult Kira→Neo (fidèle ARCH handoff) si coût marginal OK ; sinon registry-only.

---

### DW6 — Extensibilité / non-régression

Clone 27a/27b :

1. Runtime Agent Registry only — **pas** de modif OrchestrationHost / Core orch / Kernel API.
2. Persona seeds Core (Persona Engine) + `/personas`.
3. Contracts bump (ex. `0.1.19`) + grants + Adam delegate permissions.
4. Dry-run **déterministe** (mêmes inputs → mêmes champs mode / would_*).
5. Gate install : `kira` / `neo` / `nyx` → true ; rien d’autre hors catalogue.
6. Aucune logique métier Runtime/Core/Host.

**Recommandation :** accepter DW6.

---

### DW7 — Critères de validation PO (27c) & J17

1. Neo, Kira, Nyx installables / activables.
2. Golden Neo : `would_sync === true` · mode dry-run.
3. Golden Kira : triage `content` non vide (+ catégories / priority si schéma).
4. Golden Nyx : `would_render === false` · storyboard non vide.
5. Zéro réseau tiers · aucun workflow nouveau.
6. Architecture Persona → Skills → Kernel → Tools.
7. **12 agents** first-party listés dans Registry/seeds.
8. Après Accept PO livraison : **Jalon J17 — Catalogue agents v1 atteint**.

---

### DW8 — Hors scope / gel post-27c

- Phase 28 (OAuth / live) — **pack dédié requis**, pas d’auto-enchaînement
- `skill.translation`
- Rendu vidéo réel / providers image-vidéo
- HITL · marketplace UI
- Nouveaux nœuds Workflow Engine
- Exécution d’automations Nexus (toujours plan-only)

---

### DW9 — Model Profile Nyx

DU7 : réévaluer profil dédié en 27c.

| Option | Choix |
|--------|-------|
| **A** | Réutiliser `creative-balanced` (recommandé) |
| **B** | Nouveau profil `video-creative` | Nécessite route LLM + Rate Card — ADR/décision séparée |

**Recommandation :** **A** — pas de nouveau Model Profile sans décision dédiée.

---

## Impacts (si Accepted)

| Zone | Impact |
|------|--------|
| `agents/{neo,kira,nyx}` | `handleTask` réel |
| `skills/{crm-assist,support-triage,video-brief}` | Nouveaux packages |
| `tools/crm-sync`, `tools/video-pipeline` | Dry-run déterministe |
| Contracts / personas / Runtime registry | Seeds + registration |
| ROADMAP / ARCHITECTURE | **J17 atteint** après validation PO |

---

## Synthèse recommandations

| ID | Reco |
|----|------|
| DW1 | Neo + Kira + Nyx only → puis J17 |
| DW2 | crm-assist · support-triage · video-brief |
| DW3 | `crm-sync` dry-run enabled |
| DW4 | `video-pipeline` storyboard · `would_render: false` |
| DW5 | can_consult Neo/Kira/Nyx + golden consult Kira→Neo optionnel |
| DW6 | Registry only · dry-run déterministe |
| DW7 | 3 goldens + 12 agents → J17 post-PO |
| DW8 | Gel P28 / live / translation / rendu |
| DW9 | Pas de nouveau Model Profile |

---

## Questions PO

1. Confirmes-tu **dry-run** (pas mock) pour `crm-sync` et `video-pipeline` — aligné 27a/27b ?
2. Kira : **aucun tool** (DW2-A) OK ?
3. Exiges-tu un **golden `task.consulted` Kira→Neo**, ou registry `can_consult` suffit ?
4. Nyx : ids `skill.video-brief` + tool `video-pipeline` OK ?
5. Confirmes-tu que **J17** est déclaré atteint **à la validation PO de la livraison 27c** (pas au seul Accept de ce pack) ?

---

## Prochaine étape

- **Attendre Accept DW1–DW9** (évent. amendé).
- Puis implémenter **27c uniquement** — stop — **pas de Phase 28** sans pack dédié.
