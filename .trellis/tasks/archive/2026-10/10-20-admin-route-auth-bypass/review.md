# Issue #629 final review

Reviewed on 2026-10-20 against the task PRD, design, execution plan,
`check.jsonl`, root engineering rules, and the management-route authentication
specification. Read the complete native hook context from its saved file before
checking. Context-mode tools were unavailable in the reviewer tool catalog;
bounded RTK commands were used instead.

## Findings (fixed)

None. No product, test, or specification changes were necessary during review.

## Findings (not fixed)

None in the authorized scope.

## Behavior and boundary review

- `index.ts` installs the shared management registrar after the global limiter
  and retired-route guard and before all API plugins. The updated source-order
  assertion tracks this real registration path.
- `adminRouteGuard.ts` classifies both protected management routes and public
  exceptions using `request.routeOptions.url ?? request.url`. Fastify supplies
  the matched route identity in `onRequest`, including prefixed nested plugins
  and encoded static segments. Only unmatched requests use the raw fallback.
- Existing IP-first/token validation remains in `authMiddleware`. Its rejection
  replies prevent administrator limiter execution and business handler access.
  The limiter preserves the `admin-authenticated` bucket, shared `admin`
  identity, configuration values, error payload, and once-only accounting.
- Desktop health and OAuth callbacks still use the existing public predicate.
  Query strings and equivalent encoded static segments now share the matched
  identity. Proxy routes stay outside `/api/` classification and keep their own
  authentication. The existing static SPA fallback does not expose a protected
  matched handler.
- Regression tests invoke the production registrar and real administrator
  authentication/limiter. They use synthetic settings handlers and a mocked
  downstream-token service, assert handler non-invocation on rejection, and do
  not inspect real credentials or backups. Coverage includes GET, POST, PUT,
  PATCH, DELETE, auto-registered HEAD, nested settings routes from the issue,
  shared limits/expiry, public exceptions, proxy controls, and unmatched paths.
- The management authentication spec and backend index agree with the code,
  error matrix, test strategy, and deployment limits. No schema, dependencies,
  settings contracts, endpoint signatures, or frontend changes were introduced.

## Verification

Reviewer reruns, all exit 0:

```powershell
rtk npm run typecheck:server
rtk proxy npm test -- src/server/middleware/adminRouteGuard.test.ts src/server/middleware/globalRateLimit.test.ts --maxWorkers=2 --exclude '.codex/**'
rtk git diff --check
```

- TypeCheck: pass.
- Tests: pass, 2 current source files / 59 tests. The `.codex/**` exclusion
  prevents historical diagnostic source copies from joining the run.
- Lint: unavailable; `package.json` defines no lint script. Server type-check
  and whitespace verification passed.

Inspected the implementation verification record: the complete focused run
passed 8 files / 100 tests; server build and repository drift check passed,
with 0 violations and 3 pre-existing tracked architecture debt entries. Those
broader checks were not repeated because review made no code changes. The
recorded negative control changed the production classifier temporarily to
`request.url`: both reported encoded settings URLs returned 200 instead of 401,
while plain controls passed, then the fix was restored in `finally`. Review
did not repeat that mutation.

## Recommendation and limits

The local fix meets the task acceptance criteria and is ready for the parent's
scoped local commit and task finish process. Reviewer wrote only this review
record and preserved unrelated files. No production application startup, real
account/backup access, deployment, push, or credential rotation was performed.
The running service requires a rebuilt, repaired deployment; local verification
does not establish whether historical disclosure occurred.
