# ADR-004 — Authentification : Clerk comme IdP + abstraction `packages/auth`

- **Status:** Accepted
- **Date:** 2026-07-18
- **Deciders:** Product / Architecture (validation explicite)
- **Option retenue:** B — Clerk (Identity Provider) + abstraction totale + séparation identité / domaine

## Context

AT72 Verse est un SaaS multi-tenant. Il faut authentifier les utilisateurs de façon sécurisée (Phase 05) tout en :

- évitant de reconstruire MFA, recovery, sessions from scratch ;
- préservant la souveraineté des données métier ;
- permettant un remplacement futur de l’IdP sans réécrire la plateforme ;
- distinguant clairement « être connecté » et « avoir un droit métier ».

## Decision

### 1. Fournisseur MVP

**Clerk** est le **Identity Provider (IdP)** au MVP.

### 2. Clerk = identité uniquement

Clerk est **uniquement** responsable de :

- signup / login / logout ;
- sessions / tokens d’identité ;
- facteurs d’auth (MFA, OAuth social, etc. selon config) ;
- éventuellement l’identité technique utilisateur (email, `clerk_user_id`).

Clerk **n’est pas** et **ne doit jamais devenir** la source de vérité du domaine métier.

### 3. Verse = source de vérité du domaine

Appartiennent **exclusivement** à la base de données Verse (PostgreSQL) :

- organisations / workspaces ;
- membres, **rôles métier**, permissions (RBAC Verse) ;
- agents, skills, tools, personas ;
- conversations, runs, steps ;
- mémoire, artefacts ;
- billing / usage lié au produit ;
- et toute autre donnée fonctionnelle.

Toute synchronisation IdP → Verse (webhooks Clerk : user created/updated/deleted) ne fait qu’alimenter des **références d’identité** (`users.external_auth_id`, email, etc.), pas le modèle métier.

> Si Clerk propose des « Organizations » natives : elles ne remplacent **pas** `organizations` / `memberships` Verse. Au plus, mapping optionnel d’IDs externes — la vérité reste Verse.

### 4. Abstraction obligatoire : `packages/auth`

`packages/auth` expose une **interface indépendante du fournisseur** (ports), par exemple conceptuellement :

- `getAuthSession()` / `requireAuth()`
- `getAuthUserId()` (id Verse et/ou subject IdP résolu)
- validation webhook IdP (adapter)
- helpers guards côté API

**Règle :** l’ensemble de l’application (`apps/web`, `apps/api`, workers concernés) utilise **uniquement** cette abstraction.  
Aucun module métier n’importe le SDK Clerk directement (sauf l’**adapter** Clerk isolé derrière `packages/auth`).

Remplacement futur (Auth.js, Auth0, Keycloak, autre) = **nouvel adapter** + config, **sans modifier** le reste de la plateforme.

### 5. Séparation des rôles

| Couche | Nature | Géré par |
|--------|--------|----------|
| **Rôles / état d’authentification** | Utilisateur authentifié ou non ; subject IdP ; session valide | IdP (Clerk) + `packages/auth` |
| **Rôles métier (RBAC Verse)** | `owner`, `admin`, `editor`, `operator`, `viewer`, `billing`, etc. | **Verse uniquement** (DB + Policy Engine) |

Les claims Clerk ne confèrent **aucun** droit métier automatique.  
Après authentification, Verse résout membership + rôle + permissions dans **sa** base.

### 6. Non-goals

- SCIM / SSO enterprise complet (phases ultérieures ; même abstraction).
- Stocker runs, agents ou mémoire chez Clerk.
- Faire de Clerk la source de vérité des organisations produit.

## Consequences

### Positive

- Phase 05 rapide avec bonne hygiène sécu (MFA, sessions).
- Souveraineté domaine préservée.
- Remplacement IdP possible sans big-bang métier.
- Frontière claire auth vs RBAC (moins de confusion de droits).

### Negative

- Mapping / sync webhooks à maintenir (user lifecycle).
- Coût Clerk selon usage.
- Discipline CI : interdiction d’importer `@clerk/*` hors adapter auth.

### Neutral

- Le détail session cookie vs bearer est interne à l’adapter.
- Feature flags Clerk n’influencent pas les feature flags produit Verse.

## Alternatives considered

| Option | Résumé | Motif du rejet |
|--------|--------|----------------|
| **A** — Auth 100 % custom | Contrôle total | Surface sécu et délai Phase 05 |
| **C** — Auth.js | Flexible OSS | Plus d’assemblage MFA/SSO pour un gain limité au MVP |
| **D** — Keycloak self-hosted | Enterprise IdP | Ops trop lourdes trop tôt |

## Enforcement

- Dependency rules : SDK Clerk uniquement dans l’adapter `packages/auth`.
- Tests : un user authentifié sans membership Verse → **aucun** accès métier.
- Revue modèle : aucune FK métier vers des entités Clerk non synchronisées en DB Verse.
