# Original UI rollback verification

Verified 2026-10-21 in `D:/metapi/metapi-evolution`, Windows x64, task-local
Node v25.0.0 and npm 11.8.0. Source starts at `e284c73`; original UI baseline is
first parent `67326f4` of integration `5398f46`. The user approved restoring the
old product experience while retaining security repairs, then explicitly
approved the complete implementation plan. No push or production mutation was
performed.

## Delivered behavior

- One original `src/web` interface builds at `/` into clean `dist/web` output.
  Original pages/components have no production-code delta from `67326f4`.
- Removed the incomplete Evolution UI source/public assets, standalone manifest
  and lock, dedicated config/discovery/runners, and obsolete current parity
  reports. Archived task history and unrelated local tooling remain untouched.
- Supported `/legacy/` and `/app/` bookmarks temporarily redirect to their
  original-page equivalents, preserving query strings and rejecting unsafe
  external redirect forms. API/proxy/asset namespaces retain actual auth/404
  policy and cannot become successful SPA responses.
- Existing valid retired-UI sessions work in the original interface. Existing
  admin-failure markers and upstream-proxy failure classification remain active.
- All independent administrator/IP/token/hydration and database fixes remain.
  No schema, migration, generated artifact, encryption, or business-service change.
- No retained npm package changed version; only unused `lucide-react` was removed.
  Patched production dependencies and npm/pnpm overrides remain synchronized.
- README, compose/deployment examples, workflow inputs and the owning frontend
  delivery spec describe the restored branch artifact and one-interface behavior.

## Results

File-backed logs are under ignored `docs/plans/upstream-evolution-checks/`.
The existing Node 25 harness explicitly unsets external live-schema URLs.

| Check | Result / evidence |
| --- | --- |
| Complete types: original UI, frontend tests, server, desktop | Passed (`rollback-typecheck.log`) |
| Complete build: original UI, server, desktop | Passed (`rollback-build.log`); root entry references `/assets`, no `dist/web/legacy/index.html` |
| Full suite | 514 files passed / 4 skipped; 3368 tests passed / 14 skipped (`rollback-full-tests-hooks.log`) |
| Final focused static/URL/session/auth/architecture/Docker/security checks | 8 files / 70 tests passed (`rollback-final-focused.log`) |
| Browser fixture, Playwright/Chromium | Passed (`rollback-browser-final.log`): retired session reuse; site/account editor writes; site reload; route search/group/batch controls; settings write/reload; mobile navigation |
| Built server, fresh SQLite fixture with saved private token and no environment AUTH_TOKEN | Passed (`rollback-startup-pass.log`): hydration, original root/deep links/assets/cache, bookmark redirects, reserved auth/404 rules, plain/encoded management auth |
| Full npm audit / official registry | Zero vulnerabilities (`rollback-audit-full.log`) |
| Production npm audit / official registry | Zero vulnerabilities (`rollback-audit-production.log`) |
| npm lock generation / CI installer validation | Passed (`rollback-npm-lock.log`, `rollback-ci-lock.log`; CI used dry-run/ignore-scripts) |
| pnpm 10.34.7 generation / frozen lock | Passed (`rollback-pnpm-lock.log`, `rollback-pnpm-frozen.log`) |
| Architecture drift | Zero violations (`rollback-drift.log`) |
| Whitespace, encoding, baseline preservation | `git diff --check` passed; task artifacts UTF-8 without BOM; no production page/component, retained security owner, Dockerfile or schema delta |
| Full-suite dashboard worker shutdown warning | Isolated one-worker regression passed without warning (`rollback-shutdown-regression.log`) |

There is no repository lint script; type checks, tests, build and drift check are
the applicable configured automated quality gates.

## Failures and limitations

The first full-suite attempt hit slow local SQLite setup at default hook timeout
and was stopped. The successful rerun used command-local
`--maxWorkers=2 --testTimeout=120000 --hookTimeout=120000`; no checked-in test or
production timeout changed. It emitted a forks-worker shutdown warning for
`dashboardHookOrder.test.tsx` after assertions passed; the isolated rerun passed
cleanly. See `operations-log.md` for fixture assertion corrections and retained
initial logs.

Four skipped suites/fourteen skipped tests cover live external-schema and Linux
Docker installer validation. No actual provider/account requests, real user
data, MySQL/PostgreSQL target schemas, or production writes were used. Browser
editor/settings writes targeted only an in-memory synthetic HTTP fixture.

Docker's Windows engine named pipe is unavailable. No local Linux Node 22 image
build/native rebuild/container startup or multi-architecture validation passed.
Windows Node 25 evidence is not Linux release evidence. Existing chart-size
warnings remain; chart implementation was outside rollback scope.

Both native implement and check agent dispatch failed on inherited unsupported
model `deepseek-v4-flash`; main session implemented and applied full-scope
`trellis-check` review. No independent child review is claimed. Context-mode
tools were unavailable; bounded local processing/file logs were used.

## Acceptance and release

A1-A5 and A7 pass through baseline comparison, browser fixture, actual built
server, security/full-suite and artifact checks. A6 is supplied by `deploy.md`;
actual publishing/deployment awaits separate applicable authorization and Linux
image verification. A local code commit includes the rollback, specs and this
task's evidence, excluding unrelated scaffolding and ignored validation files.
