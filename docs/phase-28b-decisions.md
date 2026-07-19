# Phase 28b — Pack de décisions (DY\*) — Accepted PO

**Statut :** **Accepted (PO 2026-07-19)** — amendement **DY2-B** (`CONNECTOR_NOT_CONNECTED`)  
**Date :** 2026-07-19  
**Prérequis :** Phase **28a validée** (commit `767902c`) · DX\* / ADR-013 Accepted  
**Lot :** Activation **live** de `social-publish` via connecteur LinkedIn **uniquement**  
**Side-effect :** **premier publish réel Verse** (compte test)  
**Implémentation :** **28b validée PO** · **Phase 29 = pack décisions dédié** (pas d’auto)

---

## Objectif

Activer le **premier side-effect réseau outil** de Verse :

- `social-publish` en dual-mode  
- branche **`mode: "live"`** uniquement si connexion LinkedIn **valide**  
- si `mode: "live"` sans connexion valide → erreur **`CONNECTOR_NOT_CONNECTED`** (pas de fallback dry-run silencieux)  
- résolution token **éphémère** via Core ToolRuntime → `OAuthConnector` + `SecretsVaultPort`  
- **aucun** secret vers Agents / Skills / Runtime / Host  

---

## Contexte (post-28a)

| Élément | État |
|---------|------|
| Vault + OAuth LinkedIn | **Opérationnels** (28a) |
| API / UI Connecteurs | Connect / Disconnect / callback |
| `social-publish` | Dry-run (pré-28b) |
| HITL | **Phase 29** |
| Kernel.tools API | **Stable** |

---

## Décisions Accepted

### DY1 — Périmètre — **Accepted**

Live `social-publish` LinkedIn only · wiring Core · contrat sortie · tests · docs.  
Hors scope : HITL · cms · multi-provider · Kernel.tools signatures · Permission/Cost Engine.

### DY2 — Conditions live — **Accepted (amendement B)**

| Cas | Comportement |
|-----|----------------|
| Sans `mode: "live"` | **dry-run** · aucun appel réseau |
| `mode: "live"` + connexion LinkedIn valide | **publication réelle** |
| `mode: "live"` + connexion absente / invalide / révoquée | Erreur normalisée **`CONNECTOR_NOT_CONNECTED`** · **aucun** appel réseau · **aucune** publication simulée |

Rationale PO : un utilisateur qui demande explicitement le live doit savoir immédiatement que la publication n’a pas pu être effectuée.

### DY3 — Resolve token Core ToolRuntime — **Accepted (A)**

Injection éphémère dans le contexte d’exécution tool (non sérialisé vers agents) · pas de secret hors Core.

### DY4 — Member UGC LinkedIn — **Accepted (A)**

### DY5 — Contrat sortie — **Accepted**

Live : `mode/published/platform/external_post_id/published_at`  
Dry-run : `mode/would_publish/platform/content`

### DY6 — Flag `mode` skill — **Accepted (A)**

Défaut dry-run · passage explicite `mode: "live"` au tool.

### DY7 — Tests — **Accepted**

CI dry-run · live unit avec fake HTTP · live réel opt-in.

### DY8 — Checklist PO — **Accepted**

Amendement point 3 : après disconnect, `mode:"live"` → **`CONNECTOR_NOT_CONNECTED`** (pas dry-run silencieux).

### DY9 — Gel — **Accepted (A)**

Pas de HITL · pas d’autre provider · pas de `scheduled_at` live (publish immédiat).

---

## Contraintes (rappel)

- Aucun secret hors Core  
- Token resolve exclusivement Core ToolRuntime  
- Kernel.tools public inchangé  
- Aucun HITL · aucun autre provider · aucun scheduling live  

---

## Synthèse Accepted

| ID | Décision |
|----|----------|
| DY1 | Live social-publish LinkedIn only |
| DY2 | **B** — `CONNECTOR_NOT_CONNECTED` si live sans connexion |
| DY3 | Resolve token Core ToolRuntime |
| DY4 | Member UGC |
| DY5 | Contrats dry-run / live |
| DY6 | Flag mode skill (défaut dry-run) |
| DY7 | CI dry-run · live opt-in |
| DY8 | Checklist (+ erreur après disconnect) |
| DY9 | Gel HITL/cms/schedule live |

---

## Prochaine étape

1. Implémenter **28b uniquement** → stop PO.  
2. **Pas de Phase 29** sans pack dédié.
