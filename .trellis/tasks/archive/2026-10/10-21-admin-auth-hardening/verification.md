# Administrator Authentication Verification

Work commit: `63eba8c`; baseline: `7fe1cf8`. Validation uses Windows, task-local Node 25.0.0/npm 11.8.0,
synthetic credentials, and isolated SQLite fixtures. No operator environment,
database, production deployment, remote push or migration changes.

## Results

| Check | Result |
| --- | --- |
| Initial focused config/auth/settings/limiter/retired/desktop tests | 11 files, 224 passed |
| Cross-layer hydration/architecture/shared credentials/session/proxy/docs tests | 12 files, 150 passed |
| Final config and token rotation tests | 2 files, 57 passed |
| Final hydration/architecture/deployment example tests | 3 files, 16 passed |
| Full repository typecheck (both web shells, web tests, server, desktop) | Passed |
| Final server build | Passed |
| Desktop build | Passed |
| Final architecture drift | 0 violations |
| Git whitespace check | Passed |
| Built-server startup smoke | 8 scenarios passed |
| Full source suite | 526 files passed, 4 skipped; 3421 tests passed, 14 skipped; 382.5 seconds |

## Startup and Security Evidence

- Production default/blank credentials and desktop external default credentials
  exit with a credential error before Fastify listens.
- Desktop loopback default login still works. Production with persisted private
  `auth_token` and no environment `AUTH_TOKEN` starts successfully.
- Persisted empty credentials override a private environment token and fail
  startup explicitly.
- Bare, wrong-scheme, malformed and incorrect headers reject; valid mixed-case
  Bearer succeeds on plain and encoded management routes.
- The reported direct loopback spoof fails with 403 whether XFF is present or
  absent. A declared loopback fixture proxy resolves the rightmost untrusted hop;
  an injected leftmost value cannot change the identity past that boundary.
- Retired plain paths return 404. Injection regressions register synthetic encoded
  retired routes and assert their handlers are never invoked.
- Fastify injection covers IPv4, IPv6, exact CIDRs and IPv4-mapped IPv6 CIDRs;
  settings display/self-lockout and per-IP bucket tests use the same resolution.
- All production auth-token setters were reviewed. Factory reset preserves the
  current credential; rotation rejects invalid values before persistence.

## Compatibility and Deployment

Production requires a private effective administrator token, including loopback
deployments. Saved non-default credentials remain valid without `AUTH_TOKEN`.
Bearer prefix is now mandatory. Desktop defaults to `127.0.0.1`; LAN access
requires a private token and explicit `HOST=0.0.0.0`.

`TRUSTED_PROXY_IPS` defaults to blank/no trust. Configure only actual controlled
proxy addresses/CIDRs and restart. A proxy must overwrite or append observed
peer addresses. IP allowlists behind an undeclared proxy now see the peer IP.
Keep existing `ACCOUNT_CREDENTIAL_SECRET`; account encryption is unchanged.

No database rollback is required. Source rollback to baseline restores the
reported weaknesses and requires appropriate network containment.

## Logs and Limits

File-backed logs live under ignored `docs/plans/upstream-evolution-checks/`:
`admin-auth-focused.log`, `admin-auth-crosslayer.log`,
`admin-auth-final-focused.log`, `admin-auth-full-typecheck.log`,
`admin-auth-final-hydration.log`,
`admin-auth-final-build.log`, `admin-auth-desktop-build.log`,
`admin-auth-final-drift.log`, `admin-auth-startup-smoke.log`, and
`admin-auth-full-tests.log`. Startup fixtures and the smoke script are local-only
under `docs/plans/`; no synthetic database is staged.

The full suite uses `--maxWorkers=2 --testTimeout=120000` for Windows migration
fixtures. Live MySQL/Postgres parity URLs are unset and live-schema tests skipped.
Docker Desktop/WSL was unavailable in the earlier validation (`starting
wsl-bootstrap: context canceled`); Windows/Node evidence does not establish Linux
container behavior. Trellis sub-agent dispatch failed for the unsupported
inherited model; implementation and quality review were completed in the main
session without changing the user's model.
