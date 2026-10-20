# Frontend Delivery and Release Validation

## Scope / Trigger

Read before changing static delivery, frontend build roots, shared administrator
sessions, or branch image build triggers. Evolution and legacy are two shells
over the same API and administrator authentication contract.

## Signatures

- `frontendEntryForPath(url: string): string | null` selects SPA fallback entries.
- `setFrontendCacheHeaders(reply: Pick<FastifyReply, 'header'>, filePath: string): void`
  owns static cache policy in `src/server/staticFrontendCache.ts`.
- `npm run build:web` builds Evolution then legacy; `npm run test:web:evolution`
  dispatches each frontend test to its declared runner.

## Contracts

Evolution builds into `dist/web` and serves `/`; legacy builds into
`dist/web/legacy` with base `/legacy/`. `METAPI_WEB_UI=legacy` selects the legacy
Vite build. The default build must run first because it empties `dist/web`.

`@fastify/static` calls `setHeaders` with a Fastify reply. Use `reply.header()`;
do not add raw Node response compatibility branches. Entry documents have
`Cache-Control: no-cache`; both hashed asset directories have
`public, max-age=31536000, immutable`.

Administrator failures set `x-metapi-admin-auth-failure: 1`. Both shells share
session helpers; ordinary upstream proxy 401/403 responses must not clear the
administrator session. Preserve the matched-route guard in
[management-route-auth.md](./management-route-auth.md).

GHCR branch workflow paths must include both `src/**` and
`New metapi Evolution Webui/metapi/**`. Preserve its npm 11.6.2 Docker builder
pin and Node 22 ARMv7-compatible base unless their owning runtime contract changes.

## Validation & Error Matrix

| Request / event | Required behavior |
| --- | --- |
| `/`, `/app/dashboard` | Evolution HTML, 200, no-cache |
| `/legacy/`, `/legacy/settings?tab=general` | Legacy HTML, 200, no-cache |
| Existing asset under either assets directory | 200, immutable caching |
| Missing `/api`, `/v1`, `/monitor-proxy`, or either assets path | Preserve reserved-path behavior; no SPA shell |
| Windows test discovery | Slash-normalized exclusions prevent Node tests entering Vitest |
| SQLite fixture cleanup | Close existing DB connections before deleting the directory |

## Good / Base / Bad Cases

- Base: an authenticated user opens either shell against the same backend.
- Good: a legacy deep link returns the legacy entry with cache headers applied
  by the same helper used in production and injection tests.
- Bad: `path.relative()` returns backslashes and a Vitest glob does not exclude
  the Node-runner test, producing “No test suite found”.

## Required Tests

`staticFrontendDelivery.test.ts` must exercise the production cache helper through
real Fastify static registration. Assert entry selection, both assets directories,
deep links and missing reserved paths. Keep frontend entry, shared session and
auth-origin regressions alongside this contract.

Run typecheck, build, dependency audits for the root and standalone frontend,
Evolution tests, fixture browser smoke and repository drift check. Exclude local
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
```
