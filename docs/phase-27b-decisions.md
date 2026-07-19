# Phase 27b — Pack de décisions (DV\*) — soumis PO

**Statut :** **Accepted (PO 2026-07-19)**  
**Amendements PO :** Vega `can_consult: ["orion"]` · `http-request` grant dry-run enabled · Vega `web-search` **défaut on** · Nexus = plan only (jamais d’exécution)  
**Date :** 2026-07-19  
**Prérequis :** Phase **27a validée** (commit `df1f999`) · pack DU\* Accepted  
**Lot :** **Nexus + Vega** uniquement  
**Jalon J17 :** **non atteint** (cible = fin 27c)  
**Implémentation :** **27b validée PO (2026-07-19)** · **27c pack soumis séparément**.

---

## Objectif

Étendre le catalogue agents v1 avec :

| Agent | Domaine |
|-------|---------|
| **Nexus** | Automatisations — plan d’intégration / jobs (sans exécution réelle) |
| **Vega** | Veille stratégique — brief de monitoring / intelligence |

Même modèle que 27a / P23 : **Persona → Skills → Kernel → Tools** · enregistrement **Runtime Agent Registry only**.

---

## Contexte (post-27a)

| Élément | État |
|---------|------|
| Agents opérationnels | Adam, Nova, Orion, Astra, Pixel, **Pulse**, **Echo** |
| Nexus / Vega | Placeholders P01 (`status: placeholder`) |
| Tool `http-request` | Placeholder bootstrap — **pas** encore dry-run |
| Tool `web-search` | Stub P19 opérationnel (réutilisable par Vega) |
| Skill `analysis` | Opérationnelle (reuse opt-in Vega) |
| Workflows | Aucun nouveau en P27 (DU10) |
| Contraintes P27 | Dry-run / stub only · zéro service tiers réel |

**Invariants (rappel, non négociables) :**

- Agents/Skills → contracts + Kernel only.
- **Runtime Agent Registry** = point unique d’enregistrement des agents.
- Aucune logique métier ajoutée au Runtime, Core ou Host (Host allow-list reste dérivée du registry).
- Persona seeds Core = chemin Persona Engine existant (comme 27a) — **pas** une archi parallèle.
- Tools : `mode: "dry_run"` (ou stub existant sans réseau) — **interdit** `fetch` / OAuth live.

---

## ADR

Aucun nouvel ADR. Extension catalogue sous **ADR-006** + DU\* / modèle 27a.

---

## Décisions à trancher

### DV1 — Périmètre strict 27b

**Proposition :** livrer **uniquement** Nexus + Vega :

1. Packages `pkg.nexus` / `pkg.vega` + grants + Adam `orchestration.delegate:*`
2. Personas default
3. Skills domaine + bindings
4. Tool `http-request` dry-run (Nexus)
5. Vega via `web-search` existant (+ skill veille)
6. Runtime registry + 2 golden tests
7. Docs CHANGELOG / packages-matrix

**Hors scope 27b :** Neo, Kira, Nyx (27c) · workflows · HITL · workers jobs · cron · webhooks réels · `skill.translation`.

**Recommandation :** accepter DV1 tel quel.

---

### DV2 — Bindings Nexus / Vega

**Proposition :**

| Agent | Skill primaire | Skill reuse | Tool | Mode |
|-------|----------------|-------------|------|------|
| **Nexus** | `skill.automation-plan` (**nouvelle**) | — | `http-request` | **dry-run** (`would_request`, zéro `fetch`) |
| **Vega** | `skill.watch-brief` (**nouvelle**) | `skill.analysis` **opt-in** (flag task) | `web-search` | Stub P19 (déjà sans réseau réel en CI) |

**Nommage skill Nexus — alternatives :**

| Option | Id | Commentaire |
|--------|-----|-------------|
| **A** | `skill.automation-plan` | Plan / mapping triggers→actions (recommandé) |
| **B** | `skill.automations` | Plus vague |
| **C** | Inline dans l’agent | **Rejeté** (casse Skill reuse) |

**Nommage skill Vega :**

| Option | Id |
|--------|-----|
| **A** | `skill.watch-brief` (recommandé) |
| **B** | `skill.intelligence` |
| **C** | Uniquement `skill.analysis` sans skill veille | **Rejeté** (domaine veille dilué) |

**Recommandation :** Nexus = **A** `skill.automation-plan` · Vega = **A** `skill.watch-brief` · analysis opt-in seulement.

---

### DV3 — `http-request` dry-run (contrat de sortie)

**Proposition :** activer le package tool existant avec exécution **dry-run uniquement** :

```json
{
  "mode": "dry_run",
  "would_request": true,
  "method": "GET",
  "url": "https://example.com/hook",
  "headers_keys": ["authorization"],
  "body_preview": "…"
}
```

Règles :

- Valider `method` ∈ allow-list (`GET|POST|PUT|PATCH|DELETE`) et URL absolue `http(s)`.
- **Aucun** `fetch` / undici / axios / net socket.
- Ne pas résoudre DNS ; ne pas ouvrir de connexion.
- `side_effect: true` + `auth: { type: "none" }` en dry-run (OAuth connecteurs = P28).
- Grant default **enabled: true** (aligné 27a dry-run).

**Alternative :** tool disabled by default — moins démontrable.  
**Recommandation :** enabled + `mode: "dry_run"` explicite (comme Pulse/Echo).

---

### DV4 — Périmètre métier Nexus (anti scope-creep)

Nexus **ne doit pas** devenir un moteur d’automatisation.

| Inclus MVP | Exclu |
|------------|-------|
| Produire un **plan** d’automation (étapes, outils cibles, preconditions) | Exécuter le plan |
| Appeler `http-request` dry-run pour matérialiser un intent | Triggers planifiés / Redis / workers |
| Mémoire `run.working` + lecture `org.brand` | Webhooks entrants persistés |
| Golden : `result.dry_run.would_request === true` | Marketplace connectors |

**Recommandation :** Nexus = **planificateur** via skill ; side-effects réels = P28+.

---

### DV5 — Périmètre métier Vega

| Inclus MVP | Exclu |
|------------|-------|
| Brief de veille structuré (sources, signaux, next actions) | Alerting push / email |
| `web-search` stub pour contextualiser | Scrapers dédiés · feeds RSS live |
| Opt-in `skill.analysis` si flag | Broadcast bus « alerte veille » (ARCH futur) |
| Golden : content non vide + éventuellement citation search | Dashboard veille UI |

**can_consult (DU6) :** Vega → Orion (approfondir) — **proposé pour 27b**.

**Recommandation :** accepter DV5 + `can_consult: ["orion"]`.

---

### DV6 — `can_consult` Nexus

DU6 proposait Nexus **sans** consult en MVP.

**Proposition 27b :** conserver **`can_consult: []`** pour Nexus (reste planificateur).  
**Alternative :** Nexus → Vega pour enrichir un plan — reporté si besoin après golden.

**Recommandation :** aucun consult Nexus en 27b.

---

### DV7 — Extensibilité / non-régression

Identique 27a :

1. Registry Runtime only — **pas** de changement OrchestrationHost / Core orch / Kernel API.
2. Persona JSON dans `/personas` + seeds Core (Persona Engine).
3. Contracts seeds packages/grants + bump `CONTRACTS_VERSION` (ex. `0.1.18`).
4. Adam permissions `orchestration.delegate:nexus` / `vega`.
5. Tests : 2 goldens + gate install pulse/echo non régressés · kira toujours `false` jusqu’à 27c.

**Recommandation :** clone strict du modèle 27a.

---

### DV8 — Critères de validation PO (27b)

1. Nexus et Vega **listés / installables / activables** (Registry + Grants).
2. Golden Nexus : `task.completed` + `dry_run.mode === "dry_run"` + `would_request === true`.
3. Golden Vega : `task.completed` + `content` string non vide (et search utilisé si brief l’exige).
4. Zéro appel réseau tiers dans les tools du lot.
5. Aucun nouveau workflow.
6. Aucune logique métier dans Runtime / Core / Host.
7. Architecture Persona → Skills → Kernel → Tools respectée.
8. **J17 non déclaré atteint** après 27b.

---

### DV9 — Hors scope / gel

- 27c (Neo, Kira, Nyx)
- OAuth / vault / http live / GMB live / CRM live
- Nouveaux workflows / nœuds Engine
- Jobs schedulers / Nexus runtime d’exécution
- UI catalogue agents dédiée
- `skill.translation`

---

## Impacts (si Accepted)

| Zone | Impact |
|------|--------|
| `agents/nexus`, `agents/vega` | `handleTask` réel |
| `skills/automation-plan`, `skills/watch-brief` | Nouveaux packages |
| `tools/http-request` | Dry-run impl |
| Contracts / personas / Runtime registry | Seeds + registration |
| Core orch / Host / Kernel | **Inchangés** (hors seeds persona) |

---

## Synthèse recommandations

| ID | Reco |
|----|------|
| DV1 | Nexus + Vega only |
| DV2 | `skill.automation-plan` + `skill.watch-brief` |
| DV3 | `http-request` dry-run enabled |
| DV4 | Nexus = plan only |
| DV5 | Vega = watch-brief + web-search ; consult Orion |
| DV6 | Nexus sans can_consult |
| DV7 | Clone modèle 27a / Registry only |
| DV8 | Goldens + J17 toujours non atteint |
| DV9 | Gel 27c / live / workflows |

---

## Questions PO

1. Confirmes-tu **`skill.automation-plan`** et **`skill.watch-brief`** comme ids stables ?
2. Confirmes-tu Vega **`can_consult: ["orion"]`** dès 27b ?
3. Confirmes-tu `http-request` **grant enabled** en dry-run (comme 27a) ?
4. Vega doit-il **toujours** appeler `web-search`, ou seulement sur flag `use_web_search` (recommandation : **flag opt-in**, défaut true pour le golden) ?

---

## Prochaine étape

- **Attendre Accept DV1–DV9** (évent. amendé).
- Puis implémenter **27b uniquement** — stop — **pas de 27c**.
