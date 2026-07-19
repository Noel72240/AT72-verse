# packages/auth

Provider-agnostic authentication **ports** for AT72 Verse (**Phase 05**, ADR-004).

## Rules

- **Clerk** is the MVP Identity Provider only (sessions / identity).
- Apps (`api`, `web`, workers) import **`@at72-verse/auth` only** — never `@clerk/*`.
- Business RBAC stays in Verse DB (Phase 06+) — not in the IdP.
- `AUTH_PROVIDER=dev|clerk` selects the adapter (default: `dev`).

## Adapters

| Adapter | Use |
|---------|-----|
| `DevAuthAdapter` | Local, tests, CI — in-memory bearer sessions |
| `ClerkAuthAdapter` | Staging / production — verifies Clerk JWTs |

## API surface

- `createAuthProvider()`
- `AuthProvider.authenticateRequest` / `logout` / `createDevSession?`
- Types: `AuthSession`, `AuthError`, …

User provisioning (lazy upsert into `users`) lives in **`apps/api`**, not in this package.
