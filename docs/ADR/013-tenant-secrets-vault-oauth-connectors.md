# ADR-013 — Tenant Secrets Vault + OAuth Connectors

- **Status:** **Accepted**  
- **Date:** 2026-07-19  
- **Deciders:** Product / Architecture (validation explicite PO)  
- **Amendement PO :** séquence OAuth (authorize, callback, state, code, refresh, revoke) confinée au couple **API ↔ Core** (OAuthConnector + SecretsVaultPort) — aucune donnée OAuth accessible aux Agents, Skills, Runtime ou Host, même temporairement  
- **Prérequis décisions :** Phase 28 pack DX1–DX13 **Accepted** (`docs/phase-28-decisions.md`) · amendement **DX13-B** (sous-phases 28a / 28b)  
- **Option retenue :** Port vault + OAuth connectors dans Verse Core · impl MVP locale chiffrée · premier connector LinkedIn · dual-mode tools · découpage 28a → 28b

---

## Context

Après le **Jalon J17** (catalogue agents v1), les tools à side-effect (`social-publish`, etc.) fonctionnent en **dry-run** uniquement. La Phase 28 introduit les **premiers side-effects réels** Verse, ce qui exige :

1. un **coffre secrets** multi-tenant (tokens OAuth) sans exposer de plaintext ;
2. un cycle de vie **OAuth** (connect / refresh / revoke / disconnect) ;
3. une injection credentials **uniquement** depuis le Core vers le Tool Runtime — jamais via Agents, Skills, Runtime ou Host ;
4. la conservation du **dry-run par défaut** et des goldens CI.

ADR-005 couvre les credentials **LLM** (BYOK-ready). Les connecteurs OAuth tenant sont un **scope distinct** : même discipline d’opacité, port dédié, premier provider = LinkedIn, tool = `social-publish` uniquement.

Le PO impose un découpage **28a / 28b** pour valider vault + OAuth **avant** le premier publish live.

---

## Decision

### 1. SecretsVaultPort (Core)

- Introduire un port **`SecretsVaultPort`** dans Verse Core (façade / adapters).
- Implémentation MVP : **locale chiffrée** (ciphertext en stockage plateforme ; clé de chiffrement plateforme / KMS — détail d’implémentation hors ADR).
- Vendor cloud (Doppler, AWS SM, HashiCorp Vault, …) = **swap d’adapter** sans changer Kernel ni Agents.
- **Tout** accès secret connecteur **passe obligatoirement** par ce port.
- **Aucun plaintext** n’est persisté, loggé, publié sur le bus, ni exposé par une API.
- Le plaintext n’existe qu’**éphémèrement** en mémoire le temps strictement nécessaire à l’appel du connecteur / provider.

### 2. Opacité totale (Agents / Skills / Runtime / Host)

- **Agents, Skills, Runtime Agent, Host** ne manipulent **jamais** de secrets (clés API, access/refresh tokens, client secrets).
- Ils peuvent au plus connaître des **métadonnées** : `connection_id`, `provider`, `status` (`connected` | `revoked` | …).
- Le Core (OAuthConnector + VaultPort) est **seul** responsable du stockage chiffré et de la résolution éphémère.
- Clarification : le Core peut détenir le **ciphertext** ; il ne doit **pas** persister de plaintext.

### 3. OAuthConnector (Core)

- Service Core de cycle de vie OAuth **workspace-scoped** :
  - authorize URL · callback · refresh · revoke · disconnect · status
- Premier provider : **LinkedIn** uniquement (Phase 28).
- **Confinement API ↔ Core :** toute la séquence OAuth (`authorize`, `callback`, `state`, `code`, `refresh`, `revoke`) reste dans le couple **API ↔ Core** (`OAuthConnector` + `SecretsVaultPort`).
- **Aucune donnée OAuth** (authorization code, state, tokens, client secret) n’est accessible aux Agents, Skills, Runtime ou Host — **même temporairement**.
- Les routes API / UI settings appellent le Core ; le Runtime n’implémente pas OAuth.

### 4. Dual-mode tools & défaut dry-run

- `social-publish` reste en **dual-mode** : `dry_run` | `live`.
- **`dry_run` est le comportement par défaut** sur toute la plateforme.
- `live` uniquement si **toutes** les conditions sont réunies :
  1. grant `tool.execute:social-publish` ;
  2. package installé ;
  3. connexion OAuth LinkedIn **valide** ;
  4. input explicite `mode: "live"`.
- Sinon : dry-run · **aucun** appel réseau outil.

### 5. Découpage d’implémentation (DX13-B) — obligatoire

| Sous-phase | Contenu | Side-effect publish |
|------------|---------|---------------------|
| **28a** | SecretsVaultPort + OAuth LinkedIn + API/UI + gestion complète des connexions | **Interdit** — tool reste dry-run only |
| **28b** | Activation branche **live** de `social-publish` via le connecteur LinkedIn | **Autorisé** sous DX5 |

- Arrêt PO obligatoire entre 28a et 28b.
- Aucune Phase 29 (HITL) dans cet ADR ni en auto-enchaînement.

### 6. Permissions & Cost Engine

- Conservation du grant existant `tool.execute:social-publish`.
- **Aucun** changement des API publiques Permission Engine / Cost Engine / `Kernel.cost.*` pour P28.
- Coûts API LinkedIn : hors ledger tokens LLM en P28 (audit `tool_executions` seulement).

### 7. Kernel API

- `Kernel.tools.execute` **reste stable**.
- Pas de fuite de secrets dans les contrats Kernel exposés aux agents.

### 8. Hors scope (gel)

- `cms-publish` / GMB / CRM / video / http **live**
- Multi-provider social
- HITL (`require_approval`) → Phase 29
- Marketplace connecteurs
- BYOK LLM (ADR-005 inchangé)
- Nouveaux agents, skills, workflows, Model Profiles

---

## Consequences

### Positive

- Premier side-effect réel derrière une frontière vault claire.
- Validation sécurité/OAuth (28a) découplée du publish (28b).
- Dry-run CI et goldens Pulse préservés.
- Swap vault vendor sans refonte agents.

### Negative

- Deux livraisons / deux stops PO (28a puis 28b).
- Discipline stricte redaction logs / bus / API à maintenir.
- App LinkedIn + comptes test requis avant preuve live 28b.

### Neutral

- Aligné ADR-005 sur l’opacité secrets ; scope connecteurs séparé.
- UI connecteurs minimale (DX6) ; UX riche différée.

---

## Alternatives considered

| Option | Résumé | Motif du rejet |
|--------|--------|----------------|
| **A** — Phase unique vault+OAuth+live | Plus rapide | PO exige validation secrets/OAuth avant side-effect |
| **B** — Étendre ADR-005 seulement | Un seul ADR LLM+OAuth | Scopes et cycles de vie distincts |
| **C** — OAuth dans Runtime / Host | Proximité agents | Contredit opacité + Host générique |
| **D** — Secrets en env process | Simple | Non multi-tenant / non workspace |
| **E** — Live auto dès connexion | Moins de friction | Contredit DX5 (flag explicite + défaut dry-run) |
| **F** — Inclure cms-publish | Deux stacks | Contredit DX2 |

---

## Enforcement

- Aucun secret / token / client_secret dans `agents/**`, `skills/**`, Runtime, Host.
- Accès secrets connecteurs **uniquement** via `SecretsVaultPort`.
- Tests : unit vault (no plaintext leak) · OAuth connect/revoke (28a) · live opt-in seulement (28b).
- CI publique : dry-run + vault ; pas de live obligatoire sans secrets.
- Boundaries P09 : Core sans imports agents ; agents → Kernel only.

---

## Implementation gates (process)

1. **PO a Accepté cet ADR** et le pack DX\*.  
2. Implémenter **28a uniquement** → stop PO.  
3. Pack/livraison **28b** → implémentation live → stop.  
4. **Pas de Phase 29** auto.

---

## References

- `docs/phase-28-decisions.md` (DX1–DX13 Accepted · DX13-B)  
- `docs/ADR/005-llm-byok-ready-credential-resolver.md` (discipline secrets LLM)  
- ARCHITECTURE §18.4–18.5 (Tool Runtime · Connecteurs)  
- Phase 19 Tool Runtime · Phase 20 Permission Engine · Phase 27a `social-publish` dry-run
