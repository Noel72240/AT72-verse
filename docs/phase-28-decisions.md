# Phase 28 — Pack de décisions (DX\*) — Accepted PO

**Statut :** **Accepted (PO 2026-07-19)** — amendement **DX13-B** (sous-phases 28a / 28b) · contrainte OAuth **API ↔ Core only**  
**Date :** 2026-07-19  
**Prérequis :** Phase **27 validée** · **Jalon J17 atteint** (commit `3493ee9`)  
**Lot :** Connecteurs OAuth — premier lot · **social-publish / LinkedIn uniquement**  
**Découpage :** **28a** (vault + OAuth + API/UI) → stop → **28b** (live `social-publish`)  
**ADR-013 :** **Accepted** (`docs/ADR/013-tenant-secrets-vault-oauth-connectors.md`)  
**Implémentation :** **28a validée PO** · **28b = pack décisions dédié** (pas d’auto) · **Phase 29 non démarrée**

---

## Objectif

Passer du dry-run catalogue (P27) aux premiers side-effects réels **en deux lots validables** :

| Sous-phase | Objectif | Side-effect réseau outil |
|------------|----------|--------------------------|
| **28a** | Sécurité secrets + OAuth LinkedIn + API/UI connexions | **Aucun** publish live |
| **28b** | Activer `social-publish` **live** via connecteur LinkedIn | **Oui** (si `mode:"live"` + connexion valide) |

Alignement ARCHITECTURE §18.5 · Persona → Skills → Kernel → Tools inchangé.

---

## Contexte (post-J17)

| Élément | État |
|---------|------|
| Catalogue agents v1 | **12 agents** · J17 atteint |
| `social-publish` | Dry-run (Pulse) · seul tool live prévu (28b) |
| `cms-publish` | **Hors scope P28** |
| Vault / OAuth | Absents → **28a** |
| HITL | **Phase 29** |

---

## Décisions Accepted

### DX1 — Périmètre strict — **Accepted**

Périmètre global Phase 28 (réparti 28a/28b) :

1. `SecretsVaultPort` + impl locale chiffrée  
2. OAuthConnector LinkedIn (authorize / callback / refresh / revoke / disconnect)  
3. API + UI settings connecteurs  
4. `social-publish` dual-mode (défaut dry-run) — **live en 28b uniquement**  
5. Audit connexions + `tool_executions` sans secret  
6. Preuves : 28a = connect/revoke/no leak · 28b = publish réel + dry-run CI  

**Hors scope :** HITL · cms-publish · GMB/CRM/video/http live · nouveaux agents/skills/workflows/Model Profiles  

---

### DX2 — Intégration live — **Accepted : social-publish uniquement**

Pas de `cms-publish` en P28.

---

### DX3 — Provider — **Accepted : LinkedIn**

Premier provider supporté.

---

### DX4 — Vault — **Accepted : SecretsVaultPort + locale chiffrée**

```text
UI / API → OAuthConnector (Core) → SecretsVaultPort.put(ref, ciphertext)
Tool live (28b) → ToolRuntime → Connector.resolve(ref) → plaintext éphémère → API LinkedIn
→ audit sans token
```

- Ciphertext en stockage · **aucun plaintext persisté**  
- Plaintext **uniquement** le temps de l’appel connector  
- Accès secrets **uniquement** via `SecretsVaultPort`  

---

### DX5 — Dual-mode — **Accepted**

- **Défaut = `dry_run`** (plateforme entière)  
- Live **seulement** si `mode: "live"` **et** connexion OAuth valide  
- Sinon dry-run · **zéro** réseau outil  
- En **28a** : pas de branche live outil (dry-run only côté tool)  

---

### DX6 — API / UI — **Accepted**

- API : start OAuth · callback · status · disconnect/revoke (workspace)  
- Web : settings « Connecteurs » — Connect / Disconnect LinkedIn  
- Runtime / Host : aucune UI OAuth · aucun secret  

Livré en **28a**.

---

### DX7 — Permissions & Cost — **Accepted**

- Grant existant `tool.execute:social-publish` conserve  
- **Aucun** changement Permission Engine (API publique) ni Cost Engine / `Kernel.cost.*`  
- Connexion = prérequis live (28b) ; sinon dry-run  

---

### DX8 — HITL — **Accepted : reporté Phase 29**

Pas d’approve en P28 · pas d’enchaînement auto P29.

---

### DX9 — Checklist PO — **Accepted**

**28a :**

1. Connect LinkedIn → `connected`  
2. Disconnect / revoke → plus de connexion active  
3. Aucun secret en clair persisté / loggé / bus / API  
4. Accès secrets uniquement via `SecretsVaultPort`  
5. Agents / Skills / Runtime / Host ne manipulent aucun secret  

**28b (en plus) :**

6. `mode:"live"` + connexion → post réel + `published` / `external_post_id`  
7. Sans live ou sans connexion → dry-run · zéro réseau  
8. Goldens dry-run Pulse non régressés  
9. Pas de live CMS/GMB/CRM/video/http  

---

### DX10 — Tests — **Accepted**

- CI : dry-run + unit vault  
- Live LinkedIn : **opt-in** uniquement (`VERSE_LIVE_OAUTH=1` + secrets)  
- 28a : tests OAuth/vault **sans** publish live obligatoire  

---

### DX11 — Limites architecture — **Accepted**

| Zone | Autorisé | Interdit |
|------|----------|----------|
| Core | VaultPort · OAuthConnector · resolve éphémère · ciphertext | Plaintext persisté · logique métier Pulse |
| Contracts | Types connexion / erreurs / `mode` | Casser `Kernel.tools.*` |
| `social-publish` | Branche live **en 28b** via connector | Tokens / secrets embarqués |
| API / Web | OAuth + settings (28a) | Secrets dans responses |
| Agents / Skills / Runtime / Host | Métadonnées connexion au plus | Toute clé · HTTP OAuth · bypass VaultPort |
| Workflows / Model Profiles | — | Nouveaux en P28 |

**Clarification :** le Core peut détenir le **ciphertext** via le port ; **aucun plaintext** persisté dans le Core.

---

### DX12 — Gel post-P28 — **Accepted**

HITL (P29) · cms / GMB / CRM / video / http live · multi-provider · marketplace · BYOK LLM · nouveaux agents/skills/workflows/profiles · **pas d’auto-enchaînement P29**.

---

### DX13 — Découpage — **Accepted : B (28a / 28b)** — amendement PO

| Sous-phase | Contenu | Stop |
|------------|---------|------|
| **28a** | `SecretsVaultPort` + OAuth LinkedIn + API/UI + gestion complète des connexions (connect / status / refresh / revoke / disconnect) · **0** publish live outil | **Obligatoire** — validation PO sécurité + OAuth |
| **28b** | Activation mode **live** de `social-publish` via connecteur LinkedIn (DX5) | **Obligatoire** — validation PO side-effect réel |

**Rationale PO :** valider indépendamment la sécurité des secrets et OAuth **avant** le premier side-effect réel Verse.

**Interdit en 28a :** branche `mode:"live"` fonctionnelle sur `social-publish` (reste dry-run only).  
**Interdit en 28b :** élargir au-delà de LinkedIn / social-publish · HITL · cms.

---

## Contraintes PO (rappel — non négociables)

- Aucun secret en clair persisté, loggé, envoyé sur le bus ou exposé par API.  
- Plaintext uniquement au moment strictement nécessaire à l’appel connector.  
- Tous les accès secrets via **`SecretsVaultPort`**.  
- Agents, Skills, Runtime, Host : **jamais** de manipulation directe de secrets.  
- **`dry_run` = défaut** sur toute la plateforme.

---

## ADR-013

- **Principe :** validé PO.  
- **Fichier :** `docs/ADR/013-tenant-secrets-vault-oauth-connectors.md`  
- **Statut ADR :** **Accepted** · confinement OAuth API↔Core · découpage 28a/28b.

---

## Impacts (après validation ADR-013)

| Zone | 28a | 28b |
|------|-----|-----|
| Core | VaultPort · OAuthConnector LinkedIn | Resolve token pour ToolRuntime live |
| Contracts | Types connexion | Erreurs live / `mode` si besoin |
| API / Web | OAuth + settings | — (réutilise 28a) |
| `social-publish` | Reste dry-run | Branche live |
| Agents / Skills | Inchangés | Inchangés |
| Permission / Cost Engine | Inchangés | Inchangés |

---

## Synthèse Accepted

| ID | Décision |
|----|----------|
| DX1 | Périmètre Vault + OAuth LinkedIn + social live + preuves |
| DX2 | social-publish only |
| DX3 | LinkedIn |
| DX4 | SecretsVaultPort locale chiffrée |
| DX5 | Dual-mode · défaut dry-run |
| DX6 | API + UI minimale |
| DX7 | Grant existant · pas Permission/Cost Engine |
| DX8 | HITL → P29 |
| DX9 | Checklist 28a puis 28b |
| DX10 | CI dry-run · live opt-in |
| DX11 | Limites architecture |
| DX12 | Gel strict |
| DX13 | **28a → stop → 28b** |

---

## Prochaine étape

1. **28a validée PO** — stop.  
2. Pack de décisions **28b** dédié → Accept PO → puis seulement code live.  
3. **Pas de Phase 29** sans pack dédié.
