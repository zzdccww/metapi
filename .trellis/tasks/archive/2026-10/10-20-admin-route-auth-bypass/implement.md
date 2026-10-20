# Execution plan

## Gate

- [x] User approved Trellis task creation.
- [x] Source investigation and isolated candidate evidence available.
- [x] Requirements, design, execution plan, and role manifests prepared.
- [x] Present final planning summary and receive explicit approval to start (2026-10-20, resumed session).
- [x] Run `task.py start` only after that approval.

## Implementation

1. Dispatch Trellis implementer with explicit ownership of `src/server/index.ts`, new `src/server/middleware/adminRouteGuard.ts`, new `adminRouteGuard.test.ts`, and management-guard integration in `globalRateLimit.test.ts`.
2. Build the production-path regression fixture and demonstrate that the vulnerable raw-prefix behavior fails the security assertions, then apply the shared registrar fix. Keep all mutations local; do not bootstrap real data.
3. Preserve existing administrator credential/IP validation, limiter semantics, global/retired-guard ordering, public exceptions, and proxy independence.
4. Run focused suites using `npm test -- src/server/middleware/adminRouteGuard.test.ts src/server/middleware/auth.test.ts src/server/middleware/auth.proxy.test.ts src/server/middleware/globalRateLimit.test.ts src/server/middleware/requestRateLimit.test.ts src/server/desktop.test.ts src/server/retiredMonitorRouteGuard.test.ts src/server/routes/api/oauth.registration.test.ts`.
5. Run `npm run typecheck:server`, `npm run build:server`, and `npm run repo:drift-check`. Use low worker concurrency if needed. Record failures and fix only those attributable to this change.
6. Dispatch Trellis checker after implementation to review the final diff, boundary assertions, test credibility, cleanup, and verification evidence. Fix attributable failures and rerun only affected checks.
7. Parent session updates the security routing spec and local verification record, inspects final scope, and performs the local commit/session finish process. Never stage unrelated existing untracked files or push/deploy.

## Validation limits and rollback points

The previous `.codex/security-629/reproduce.mjs` extracted the old inline guard; its saved result is historical evidence, not a test of the new production registrar. New Vitest coverage must exercise production code directly. Full real-service or Docker deployment validation is outside this task. Any local rollback must retain evidence of the vulnerability and keep external exposure closed.

## Completion evidence

- [x] Shared production guard and startup integration retained; regression coverage strengthened with exact issue URLs through nested plugins, PATCH, and automatic HEAD.
- [x] Old raw-URL classifier failed both encoded issue cases; fixed matched-route classifier restored before final checks.
- [x] Current-source focused suites passed: 8 files / 100 tests. Historical `.codex` source copies excluded by CLI flag; see `verification.md` for the initial discovery failure.
- [x] Server type-check, server build, and repository drift check passed; drift reported zero violations and three pre-existing tracked debt entries. No lint script exists.
- [x] Independent final reviewer found no blocking findings; reviewer type-check and two touched suites passed (59 tests).
- [x] Management authentication contract recorded in `.trellis/spec/backend/management-route-auth.md` and linked from the backend index.
- [x] Scoped local work commit `4422852` contains the four code/test files and management-authentication spec/index. Task/session finish records follow; no push or deployment.
