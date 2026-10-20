# Upstream Evolution Integration Verification

Verified on 2026-10-21 in `D:/metapi/metapi-evolution`, Windows x64, task-local
Node v25.0.0 and npm 11.8.0. Source is the verified merge of local `67326f4` and
upstream `674db2e`, committed as `5398f4647060e7412286e81c3b25732eb73dbb13`.
No remote push or production
deployment occurred.

## Delivered Behavior

- Integrated all six reviewed upstream commits. Evolution is the default `/`
  interface; the existing interface is served at `/legacy/`.
- Preserved administrator matched-route authentication, limiter registration,
  schema metadata ownership filtering, Node 22 Docker base and npm 11.6.2 pin.
- Resolved the static callback conflict using the actual Fastify reply contract.
  Production and injection tests use `setFrontendCacheHeaders()` together.
- Fixed residual security findings: root `follow-redirects` 1.16.0 → 1.16.1,
  standalone Evolution Vite 7.3.6 → 7.3.7. npm/pnpm constraints are synchronized;
  security-floor tests cover both npm lockfiles.
- Fixed Windows test portability: normalize test-discovery paths, accept CRLF
  in configuration assertions, exclude local validation snapshots, and close
  SQLite connections before deleting test directories in twelve affected suites.
- Aligned Docker lock validation with the Dockerfile's npm pin and added the
  Evolution source directory to the GHCR branch image workflow triggers.

## Results

Verbose logs remain under ignored `docs/plans/upstream-evolution-checks/`.
Commands use `docs/plans/upstream-evolution-run-check.py` to select Node 25,
capture bounded summaries and unset external live-test database URLs.

| Check | Result / log |
| --- | --- |
| Native SQLite dependency under Node 25 | In-memory query passed |
| Root npm dependency installation | `npm ci` completed in the resumed work; final `npm ci --dry-run --ignore-scripts --no-audit --no-fund` passed (`lock-ci-dryrun.log`) |
| Root full audit | 0 vulnerabilities (`audit-full-patched.log`) |
| Root production audit | 0 vulnerabilities (`audit-production-patched.log`) |
| Standalone Evolution audit | 0 vulnerabilities (`audit-evolution-patched.log`) |
| pnpm frozen lock validation, pnpm 10.34.7 | Passed (`pnpm-frozen-lock.log`) |
| Complete typecheck: both frontends, frontend tests, server, desktop | Passed (`typecheck-final.log`) |
| Complete build: Evolution, legacy, server, desktop | Passed (`build.log`); existing large-chart chunk warnings remain |
| Full source suite, `--maxWorkers=2 --testTimeout=120000` | 524 files passed, 4 skipped; 3339 tests passed, 14 skipped (`full-tests-final.log`) |
| Separate Evolution Node tests | 71 passed (`evolution-tests.log`) |
| Separate Evolution Vitest tests | 13 files / 84 tests passed (`evolution-tests.log`) |
| Final config/static/security checks after workflow-trigger addition | 22 tests passed, 1 platform skip (`final-config-regressions.log`) |
| Architecture drift | 0 violations (`drift-final.log`) |
| Fixture browser smoke, Chromium 156 / Playwright | 17 built pages; notification/WebDAV writes and reload, model search focus, keyboard toggle, three languages, system theme, mobile navigation, expiry, legacy deep link (`browser-smoke-ready.log`) |
| Built server startup, fresh local SQLite fixture | Migration, public health, both shells/assets/deep links/cache headers, plain and encoded management authentication passed (`startup-smoke-fixed.log`) |
| Preservation comparison | Baseline auth/schema production code and regressions unchanged; Dockerfile unchanged; GHCR workflow changed only to include the new UI build input |

## Failures Resolved and Verification Limits

Initial suites picked up old `.codex` source snapshots and Windows-backslash
Node test exclusions did not match Vitest. Their failures were fixed at test
discovery ownership. CRLF parsing failures and open-DB fixture deletions were
fixed in the relevant tests, without changing production database behavior.

The initial 5-second and subsequent 30-second command-local timeouts were
insufficient for the local migration recovery fixture. It passed with one worker
and a 120-second per-test timeout, then the complete suite passed with two
workers and that timeout. No production timeout or global test configuration
was raised; the original failure logs are retained.

Four skipped suites / fourteen skipped tests cover isolated live schema checks
and Docker installer validation. `DB_PARITY_SKIP_LIVE_SCHEMA=true` is set, and
`DB_PARITY_MYSQL_URL` / `DB_PARITY_POSTGRES_URL` are explicitly unset. Live
MySQL/PostgreSQL schemas and actual accounts were not used.

Docker Desktop 4.30.0 could not start its WSL engine: “starting wsl-bootstrap:
context canceled”. The Docker API remained unavailable. No Linux image build,
native rebuild, container startup or multi-architecture verification passed in
this session. Windows Node 25 startup is supplementary evidence, not Linux
Node 22 validation. The Linux Docker lock test remains a platform skip here;
its command now uses the release Dockerfile's pinned npm.

Native Trellis implement dispatch failed because the inherited model
`deepseek-v4-flash` was not accepted by the collaboration tool. Implementation
and full-scope review were completed in the main session. Context-mode MCP tools
were not exposed; bounded local analysis and file-backed logs were used.

## Release and Rollback

There are no schema changes or new required runtime environment variables.
Retain existing `AUTH_TOKEN`, `PROXY_TOKEN`, `ACCOUNT_CREDENTIAL_SECRET`, database,
host/port and notification configuration. Keep the running image digest and a
database backup before a later rollout.

After local commit, a separately authorized push to `metapi-evolution`
will trigger `.github/workflows/build-branch-image.yml`, publishing
`ghcr.io/<owner>/<repo>:metapi-evolution`. Require a successful Linux amd64 build
and fresh-data container smoke before production rollout. Deploy the new digest
only after that verification; verify `/`, `/legacy/`, public health and protected
encoded management routes. Roll back using the previously running image digest.
The source baseline is `67326f4`, which still has the documented dependency
vulnerabilities and is not a preferred long-term version.

Code checks are complete. Local commits are authorized without additional
confirmation by the user-provided AGENTS.md section 9.1; this takes precedence
over the skill's generic commit confirmation step. Remote push and production
deployment remain outside this task's authorization.

Both parents are ancestors of the committed result. Integration whitespace
validation relative to the pinned upstream passed; inherited upstream Markdown
hard breaks and whitespace were retained. Unrelated local tool scaffolding and
historical validation snapshots were excluded from the work commit.
