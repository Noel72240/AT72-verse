# Connectors & Secrets Vault (Phase 28a / ADR-013)

## Scope 28a

- `SecretsVaultPort` + local AES-256-GCM encryption
- `OAuthConnector` (LinkedIn) confined to **API ↔ Core**
- API + UI Connect / Disconnect
- **No** `social-publish` live (dry-run only until 28b)

## Env

| Variable | Purpose |
|----------|---------|
| `VERSE_VAULT_MASTER_KEY` | 64-hex (32 bytes) or passphrase (scrypt) |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | Real LinkedIn app |
| `LINKEDIN_REDIRECT_URI` | Defaults to `{API_PUBLIC_URL}/connectors/oauth/callback` |
| `VERSE_OAUTH_STUB=1` | Force stub provider (CI / local without LinkedIn app) |
| `WEB_PUBLIC_URL` | Redirect after callback (default `http://localhost:3000`) |

Without LinkedIn credentials, stub mode is automatic.

## Invariants

- No plaintext in DB, logs, bus, or API responses
- Agents / Skills / Runtime / Host never see OAuth material
- `dry_run` remains platform default; live publish = Phase 28b
