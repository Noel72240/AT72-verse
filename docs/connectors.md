# Connectors & Secrets Vault (Phase 28a / ADR-013)

## Scope

- `SecretsVaultPort` + local AES-256-GCM encryption
- OAuth connectors: **LinkedIn**, **Facebook**, **Instagram** (Meta) — confined to **API ↔ Core**
- API + UI Connect / Disconnect
- Live publish: **LinkedIn** today; Facebook/Instagram connection works, live Graph publish pending

## Env

| Variable | Purpose |
|----------|---------|
| `VERSE_VAULT_MASTER_KEY` | 64-hex (32 bytes) or passphrase (scrypt) |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | Real LinkedIn app |
| `META_APP_ID` / `META_APP_SECRET` | Meta app (Facebook Login + Instagram Graph) |
| `CONNECTORS_REDIRECT_URI` | Shared OAuth callback (preferred) |
| `LINKEDIN_REDIRECT_URI` | Fallback redirect (legacy) |
| Redirect default | `{API_PUBLIC_URL}/connectors/oauth/callback` |
| `VERSE_OAUTH_STUB=1` | Force stub providers (CI / local without apps) |
| `VERSE_LIVE_OAUTH=1` | Opt-in for real live publish tests |
| `WEB_PUBLIC_URL` | Redirect after callback — production: `https://at72-verse.allotech72.fr` |
| `API_PUBLIC_URL` | Public API base for callback URL |

Without LinkedIn / Meta credentials, stub mode is automatic for that network.

## Live publish

- Default tool/skill mode = **dry-run** (no network).
- `mode: "live"` + LinkedIn connection → member UGC publish.
- `mode: "live"` + Facebook/Instagram → clear pending error until Graph publish ships.
- `mode: "live"` without connection → KernelError **`CONNECTOR_NOT_CONNECTED`** (no silent dry-run).
- Access token resolved only in Core ToolRuntime → injected on tool ctx (`oauth`) — never from Agents.

## Meta notes

- One Meta app covers Facebook + Instagram connect buttons.
- **Connect (MVP):** scope `public_profile` only — works with a Facebook Login use case in Development mode.
- Page / Instagram publish scopes (`pages_*`, `instagram_*`, `business_management`) require adding those products in Meta and often App Review; they are not requested until live Graph publish ships.
- Instagram content publishing later requires an **Instagram Business/Creator** account linked to a **Facebook Page**.
- Add the same redirect URI in the Meta app settings as on Railway.

## Invariants

- No plaintext in DB, logs, bus, or API responses
- Agents / Skills / Runtime / Host never see OAuth material (except ephemeral tool ctx from Core)
- `dry_run` remains platform default
