# Implementation and Verification Plan

## Work Order

- [x] Inspect auth, config, settings, limiter, desktop and retirement ownership;
  capture reported findings and confirm default-token compatibility.
- [x] Curate PRD, design and execution artifacts and real context manifests.
- [x] Obtain explicit approval of the final planning summary; activate task.
- [x] Implement validated explicit proxy IP/CIDR configuration with default false.
- [x] Align auth, settings and default limiter IP consumers with request.ip;
  remove raw forwarding extraction and reuse normalization where appropriate.
- [x] Implement strict administrator Bearer parsing and shared timing-safe token
  verification; update old-token rotation through the same helper.
- [x] Enforce effective credential startup policy after settings hydration;
  change desktop default bind to loopback and retain valid explicit overrides.
- [x] Align retirement guard with matched identity and raw fallback; add
  registered encoded-route regression cases without live endpoints.
- [x] Update env/Compose/deployment examples and operator documentation together.
- [x] Run focused regressions and applicable server/desktop checks. Fix real
  failures at their owner; preserve test isolation and close fixture databases.
- [x] Complete full-scope quality review, architecture drift and startup smoke;
  record uncovered environmental limits and meaningful spec contracts.
- [x] Locally commit only this task's files, archive task, record session.

## Regression Matrix

- Config: blank/unset, explicit IP/CIDR, IPv4/IPv6, invalid entries, numeric/boolean
  trust and /0 rejection; startup production/desktop/debug modes + bind matrix.
- Auth: correct/missing/bare/wrong-scheme/embedded/empty/multi-token headers,
  timing-safe length/mismatch handling, stale-token rejection after rotation.
- IP: direct reported spoof, configured trusted proxy, spoofed leftmost header,
  untrusted peer and intermediate hop, mapped IPv4 and actual allowed clients.
- Settings: display real resolved IP, reject spoof-only self-lockout avoidance,
  valid trusted proxy administration still works.
- Rate limits: default IP buckets ignore forged XFF; trusted clients and fixed
  administrator/global socket buckets retain documented composition.
- Retirement: registered encoded retired handlers never execute; existing raw
  and unmatched paths and similarly named API/SPA controls behave correctly.
- Startup: fresh isolated fixtures reject unsafe defaults before listen; saved
  non-default token without AUTH_TOKEN remains valid; desktop default loopback
  remains available without allowing explicit external default-token binds.

## Commands and Safety

Use rtk proxy and bounded file-backed logs. Task-local Node 25 is already at
`docs/plans/upstream-evolution-runtime/node_modules/node/bin/node.exe`.
Reuse/update the ignored check runner only for local validation, without global
runtime changes. Native SQLite ABI has already been verified for this runtime.

Unset DB_PARITY_MYSQL_URL and DB_PARITY_POSTGRES_URL; set
DB_PARITY_SKIP_LIVE_SCHEMA=true for tests. Never run tests against actual saved
operator credentials or databases. No new dependencies are expected.

Primary gates: targeted `npm test -- --maxWorkers=2 --testTimeout=30000` for
config/auth/rotation/settings/limiter/retired-route/desktop/runtime hydration,
`npm run typecheck:server`, `npm run typecheck:desktop`,
`npm run build:server`, `npm run build:desktop`, `npm run repo:drift-check`,
and focused synthetic startup smoke. Broaden to full source tests if the
config contract affects other suites; document command-local timeout needs.

Trellis implement/check dispatch is preferred. A prior dispatch failed because
the inherited deepseek-v4-flash model was unsupported; if still unavailable,
record the evidence and complete implementation/full-scope review in the main
session without changing the user's model configuration.
