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
| `META_LOGIN_CONFIG_ID` | Facebook Login for Business configuration ID (permissions bundle) |
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
- **Login** uses the personal admin account (e.g. Léon). **Live posts** target the selected **Facebook Page** (e.g. AlloTech72), not the personal wall.
- In Meta App → Facebook Login → **Permissions**, click **+ Ajouter** for:
  `pages_show_list`, `pages_manage_posts`, `pages_read_engagement`, `instagram_basic`, `instagram_content_publish`
  (Development mode + app admin/tester is enough to test.)
- After reconnect, choose the Page under **Page Facebook (cible des posts)** on `/connectors`.
- Instagram content publishing later requires an **Instagram Business/Creator** account linked to that Page (media URL required by Graph).
- Add the same redirect URI in the Meta app settings as on Railway.

## Invariants

- No plaintext in DB, logs, bus, or API responses
- Agents / Skills / Runtime / Host never see OAuth material (except ephemeral tool ctx from Core)
- `dry_run` remains platform default
