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
| `VERSE_LIVE_OAUTH=1` | Opt-in for real live publish tests (28b) |
| `WEB_PUBLIC_URL` | Redirect after callback (default `http://localhost:3000`) |

Without LinkedIn credentials, stub mode is automatic.

## Live publish (Phase 28b)

- Default tool/skill mode = **dry-run** (no network).
- `mode: "live"` + valid LinkedIn connection → member UGC publish.
- `mode: "live"` without connection → KernelError **`CONNECTOR_NOT_CONNECTED`** (no silent dry-run).
- Access token resolved only in Core ToolRuntime → injected on tool ctx (`oauth`) — never from Agents.

## Invariants

- No plaintext in DB, logs, bus, or API responses
- Agents / Skills / Runtime / Host never see OAuth material (except ephemeral tool ctx from Core)
- `dry_run` remains platform default
