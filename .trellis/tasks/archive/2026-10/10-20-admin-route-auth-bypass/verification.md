# Issue #629 implementation verification

Verified locally on 2026-10-20 with Node v24.13.1 and Vitest v4.1.11. All commands below ran from `D:/metapi/metapi-evolution`.

## Change and executable coverage

- `src/server/index.ts` registers the shared management guard after the retired-route guard and before API plugins.
- `src/server/middleware/adminRouteGuard.ts` classifies the matched `request.routeOptions.url`, falling back to `request.url` only without a matched route identity. The existing public-route predicate, administrator authentication/IP policy, and authenticated limiter remain the owners of their contracts.
- `adminRouteGuard.test.ts` exercises the production registrar with synthetic handlers: six plain/encoded paths across GET/POST/PUT/PATCH/DELETE; automatically registered encoded HEAD; the exact reported auth-info and backup-export URLs through nested `/api` and `/settings` plugins; credential/IP rejection and handler non-invocation; shared, once-only limiter accounting and expiry; public health/OAuth; proxy authentication; unknown paths.
- `globalRateLimit.test.ts` uses the production registrar for management integration and asserts startup registration order.

## Regression negative control

Temporarily replaced only `request.routeOptions.url ?? request.url` with `request.url` in the production registrar. The fixed expression was restored in a `finally` block before subsequent checks.

```powershell
rtk proxy npm test -- src/server/middleware/adminRouteGuard.test.ts --maxWorkers=2 --testNamePattern "protects the reported settings route"
```

Expected failure, exit 1: both unauthenticated `/%61pi/settings/auth/info` and `/%61pi/settings/backup/export?type=all` returned **200 instead of 401**. The two plain URL controls passed; 35 unrelated tests were skipped. This directly demonstrates that the regression tests detect the old production classifier.

## Final checks

```powershell
rtk proxy npm test -- src/server/middleware/adminRouteGuard.test.ts src/server/middleware/auth.test.ts src/server/middleware/auth.proxy.test.ts src/server/middleware/globalRateLimit.test.ts src/server/middleware/requestRateLimit.test.ts src/server/desktop.test.ts src/server/retiredMonitorRouteGuard.test.ts src/server/routes/api/oauth.registration.test.ts --maxWorkers=2 --exclude '.codex/**'
rtk proxy npm run typecheck:server
rtk proxy npm run build:server
rtk proxy npm run repo:drift-check
rtk proxy git diff --check -- src/server/index.ts src/server/middleware/globalRateLimit.test.ts
```

All exited 0. Focused tests: **8 files, 100 tests passed**, including 46 production management-guard tests. Server type-check and build passed. Drift check: **0 violations**, with 3 existing tracked proxy-core imports from `routes/proxy/siteConcurrencyBoundary.js` reported as debt. Diff whitespace check passed; all four code/test files have no UTF-8 BOM or trailing whitespace. `package.json` has no lint script, so no project lint command was available.

The guard-only suite also passed 39 tests before PATCH/HEAD coverage was added:

```powershell
rtk proxy npm test -- src/server/middleware/adminRouteGuard.test.ts --maxWorkers=2
```

## Initial test-discovery failure and correction

The initial focused command omitted the CLI exclusion:

```powershell
rtk proxy npm test -- src/server/middleware/adminRouteGuard.test.ts src/server/middleware/auth.test.ts src/server/middleware/auth.proxy.test.ts src/server/middleware/globalRateLimit.test.ts src/server/middleware/requestRateLimit.test.ts src/server/desktop.test.ts src/server/retiredMonitorRouteGuard.test.ts src/server/routes/api/oauth.registration.test.ts --maxWorkers=2
```

It exited 1 after discovering 50 files/417 tests, including historical source copies under `.codex/`. Six stale `globalRateLimit.test.ts` copies failed their source-order assertion because they still searched the current startup source for the removed inline authentication call; 44 files/411 tests passed. The failures came from `.codex/image-build-context`, `.codex/docker-npm-compat/source`, `.codex/docker-npm-compat/source-verified`, and `.codex/runtime-validation/{node22/source,node25/source,node25/canonical-source}`. The corrected command excluded these local diagnostic artifacts and ran only the eight current source suites. No historical files or global Vitest configuration were changed.

## Limits and rollout

Validation used local Fastify injection and synthetic settings handlers. It did not start the production application, access real account/backup data, run Docker, push, deploy, or rotate credentials. Production static serving uses `wildcard: false`; its raw-URL SPA fallback is unrelated to matched protected routes and remains unchanged.

A server rebuild and repaired deployment are required for the running service to benefit. There are no dependency, environment-variable, database, or schema changes. Local tests do not establish whether historical exposure occurred. Keep external containment in place until deployment verification; reverting to the vulnerable revision requires that containment. Real credential review/revocation remains an operational follow-up.
