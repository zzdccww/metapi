# Frontend Delivery and Release Validation

## Scope / Trigger

Read before changing static delivery, frontend build roots, administrator session
migration, or branch image build triggers. The original interface in `src/web`
is the only shipped UI. The incomplete Evolution interface was removed after
rollback of integration `5398f46`; security repairs and patched dependencies stay.

## Signatures

- `frontendEntryForPath(url: string): string | null` selects SPA fallback entries.
- `frontendRedirectForPath(url: string): string | null` maps supported UI bookmarks.
- `setFrontendCacheHeaders(reply: Pick<FastifyReply, 'header'>, filePath: string): void`
  owns static cache policy in `src/server/staticFrontendCache.ts`.
- `npm run build:web` builds one original interface; `npm run smoke:web` checks
  the built UI through synthetic API fixtures with Playwright.

## Contracts

Vite selects `src/web`, base `/`, and a clean `dist/web` output. The router has
no `/legacy` basename. Do not add a second output, an Evolution build root, or a
`METAPI_WEB_UI` selector. A build must clear stale files from earlier dual-UI
artifacts, including `dist/web/legacy`.

Supported `/legacy/<original-page>` bookmarks redirect temporarily (302) to the
root equivalent. Known `/app/` bookmarks map through the existing frontend owner:
dashboard → `/`; proxy-logs → `/logs`; checkins → `/checkin`; import-export →
`/settings/import-export`; notifications → `/settings/notify`; models/marketplace
→ `/models`; other supported page suffixes retain their original root path.
Preserve query strings. Redirects must remain same-origin paths and reject
network-path references, backslashes, or control characters. The server entry
applies decisions; it must not own a parallel mapping.

`@fastify/static` calls `setHeaders` with a Fastify reply. Use `reply.header()`;
do not add raw Node response compatibility branches. Entry documents have
`Cache-Control: no-cache`; root hashed assets have
`public, max-age=31536000, immutable`.

Administrator failures set `x-metapi-admin-auth-failure: 1`. The original UI
session helper also accepts valid `metapi-auth-token` / `metapi-auth-expires-at`
keys from the retired UI. Root `auth_token` / `auth_token_expires_at` keys remain
authoritative; expiry/logout invalidates the appropriate session, and logout
clears both pairs. Ordinary upstream proxy 401/403 responses must not clear the
administrator session. Preserve the matched-route guard in
[management-route-auth.md](./management-route-auth.md).

GHCR branch workflow paths must include `src/**` and the actual remaining build
inputs. This repository's restored branch image is
`ghcr.io/zzdccww/metapi:metapi-evolution`; its compose/docs must not deploy an
upstream Evolution image. Preserve npm 11.6.2 Docker builder pin and Node 22
ARMv7-compatible base unless their owning runtime contract changes. Keep patched
npm/pnpm dependencies/overrides and required compiler/type adaptations on rollback.

## Validation & Error Matrix

| Request / event | Required behavior |
| --- | --- |
| `/`, `/accounts`, `/settings` | Original HTML, 200, no-cache |
| `/app/dashboard` | 302 to `/`, no-cache |
| `/legacy/settings?tab=general` | 302 to `/settings?tab=general`, no-cache |
| Existing root hashed asset | 200, immutable caching |
| Missing `/api`, `/v1`, `/monitor-proxy`, or root/retired assets path | Preserve auth/404 behavior; no SPA shell |
| Unauthenticated `/api/missing` | 401 by existing unmatched management policy |
| Authenticated `/api/missing`, unregistered `/v1/missing` | JSON 404 |
| Unsafe bookmark redirect | No external redirect; normal entry/route fallback |
| Windows test discovery | Exclude local source snapshots and unused build outputs |
| SQLite fixture cleanup | Close existing DB connections before deleting the directory |

## Good / Base / Bad Cases

- Base: an authenticated user opens original pages at their root paths.
- Good: a user with a valid retired-UI session follows `/app/accounts` and reaches
  the original account editor without losing the session or query parameters.
- Bad: a partial build leaves stale Evolution assets, or a rollback reinstalls
  vulnerable locks to recover the original page implementation.

## Required Tests

`staticFrontendDelivery.test.ts` must exercise the production cache/routing
helpers through real Fastify static registration. Assert original entry, root
assets, deep links, HTTP redirects/destinations/query strings, and reserved paths.
Keep frontend entry unsafe-redirect tests, delivery architecture coverage,
session migration, auth-origin, and admin-vs-proxy failure regressions alongside
this contract. Built-server smoke must include actual guards so an authenticated
API 404 is not confused with its unauthenticated 401.

Run typecheck, build, root full/production dependency audits, lock validation,
fixture original-UI browser smoke and repository drift check. Browser fixtures
must use the actual `/api/accounts` `{ accounts, sites }` snapshot and synthetic
credentials/data; verify editor writes/reload, filters/batch controls, and mobile
navigation without real provider operations. Exclude local
source snapshots under `.codex/**` and `docs/plans/**` from test discovery.
Normalize CRLF when tests compare multiline configuration text.

Tests using `db/index.ts` must await `closeDbConnections()` before `rmSync()`;
Fastify's `app.close()` alone does not close the shared SQLite connection.
Record any command-local timeout increase and environmental container skip.
Never classify Windows/Node validation as Linux container validation.

## Wrong vs Correct

```typescript
// Wrong: raw-response API on a Fastify reply.
reply.setHeader('Cache-Control', 'no-cache');
// Correct: actual plugin callback contract.
reply.header('Cache-Control', 'no-cache');

// Wrong: delete an open SQLite fixture on Windows.
rmSync(dataDir, { recursive: true, force: true });
// Correct: use the existing DB lifecycle owner first.
await dbModule.closeDbConnections();
rmSync(dataDir, { recursive: true, force: true });

// Wrong: keep shipping a second UI to restore the original experience.
root: legacy ? 'src/web' : 'New metapi Evolution Webui/metapi';
// Correct: one clean root build plus owned bookmark redirects.
root: 'src/web';
base: '/';
```
