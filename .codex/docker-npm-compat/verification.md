# Docker image and Northflank recovery verification

Date: 2026-10-03

## Final outcome

GitHub Actions built and pushed the linux/amd64 application image. After the user redeployed the static-header fix, the observed Northflank pod completed migration, started successfully, and served the frontend and existing admin read requests with HTTP 200. This supersedes the earlier install-only validation conclusion.

## Changes and source identity

- `53d923d`: PostgreSQL/MySQL introspection skips columns without a registered base-table owner.
- `39249ed`: Docker builder pins npm 11.6.2; Node 22 remains for ARMv7 support.
- `1a28695`, `25db994`: the metapi-evolution branch builds on GitHub Actions and publishes to GHCR.
- `a286c3bb77df0733d4dbe33b78d7884b17742932`: static response headers use `FastifyReply.header()` instead of a forced `ServerResponse.setHeader()` cast. Installed @fastify/static 10.1.3 passes FastifyReply to this callback.

Repository/branch: `https://github.com/zzdccww/metapi/tree/metapi-evolution`.

## Verification evidence

- Earlier Node 25.0.0/npm 11.6.2 validation: focused tests 36 passed; core tests 3156 passed, 13 skipped; full type checking, builds, and drift check passed. This evidence covers the earlier schema repair revision, not a fresh full-suite run of a286c3b. See `.trellis/tasks/archive/2026-10/10-03-node-runtime-release-validation/verification.md` for source identity and exclusions.
- Docker configuration tests: 8/8 passed on the earlier source-verified snapshot.
- Same Node 22.23.3/manifests with npm 11.6.2: the exact dependency install command passed, 878 packages installed, manifest hashes unchanged.
- Static-header fix: `npm run typecheck:server`, `npm run build:server`, and `git diff --check` passed.
- Final static request regression: `node .codex/docker-npm-compat/verify-static-headers.mjs` passed on local Node 24.13.1. The harness extracts the actual callbacks from src/server/index.ts and registers the installed Fastify/static plugin against temporary files. Eight requests verify `/`, `/index.html`, `/dashboard`, missing `/favicon.ico` SPA fallback (200 and no-cache), `/assets/app.js` (200 and immutable caching), `/favicon.png` (200), and missing `/api/*` and `/v1/*` endpoints (404 JSON). This runs without external databases or schedulers. Local Node 24 remains below the declared development requirement of Node 25.

## Published image

- Image: `ghcr.io/zzdccww/metapi:metapi-evolution`.
- Platform: linux/amd64.
- Final digest: `sha256:51e87109451867c37d7f79267bcfadddbfd81089554fac1909b55d4147b5303b`.
- Actions run: `https://github.com/zzdccww/metapi/actions/runs/37111462053`.
- Source SHA: a286c3bb77df0733d4dbe33b78d7884b17742932; run conclusion success; build and push completed.

The Dockerfile's native rebuild, application compilation, production pruning, and final image export were completed by this GitHub build. That build alone does not prove application startup.

## Northflank observation after user redeployment

Read through the logged-in browser's service Observe/Logs page. Current pod: `metapi-5ff5bd6d75-d494b`; service Running, replicas 1/1.

- 09:03:29 UTC: Migration complete.
- 09:03:46 UTC: Server listening on port 4000.
- 09:04:00 UTC: GET / returned HTTP 200; JS/CSS resources also returned 200.
- 09:04:03-11 UTC: logo/favicon, dashboard requests, and /api/sites returned 200.
- 09:04:34 UTC: /api/events?limit=30 still returned 200 from the same pod.
- No new static-header exception or process exit appeared in the observed new-pod interval. Old pod dcchx errors remained in the all-deployments history and are not new-pod failures.

The user performed the redeployment. The browser observation establishes recovery in this bounded interval; it does not independently establish the deployed digest or long-term stability.

## Limits and local diagnosis corrections

- Local Docker Desktop intermittently returned API 500. Full local image attempts stalled while npm prune was active; adding --ignore-scripts did not resolve it. A reduced-context attempt also stalled, so attributing the problem to .codex context size was not supported.
- A pre-prune diagnostic image exported successfully, with layer export taking 139.8 seconds. Prune inside that image remained incomplete during the observed low-CPU interval. These observations do not prove a BuildKit deadlock or an npm internal root cause; they remain unresolved local environment diagnostics. GitHub completed the unchanged prune instruction.
- VPS build/startup is excluded at the user's request. The VPS reported 939 MiB total RAM and no swap, but no actual build or OOM was observed. Resource insufficiency was a precautionary assessment, not a measured failure.
- ARM64/ARMv7 image builds, proxy upstream calls, billing/write workflows, desktop packaging, and extended stability were not verified in this final pass.
- Verification records omit credentials and live request payloads.
