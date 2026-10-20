# Fix encoded management route authentication bypass

## Goal

Prevent requests that resolve to protected management APIs from bypassing administrator authentication, the management IP allowlist, or the authenticated administrator rate limit through URL encoding. This closes the local defect reported in upstream Issue #629.

## Background

- User requested a product-code fix after the previous read-only investigation and approved creating this Trellis task on 2026-10-20.
- P0 defect: `src/server/index.ts:227` classifies management APIs using the raw URL, while Fastify recognizes encoded static route segments. The source-derived investigation passed 34 assertions demonstrating the defect and an in-memory candidate fix; see `.codex/security-629/verification.md` and `results.json`.
- `src/server/routes/api/settings.ts:1852` relies on the global guard for backup export. `src/server/services/backupService.ts:1331` and `:1407` export account credentials and permitted settings, respectively, so authentication must be fixed at the shared entry point.
- Existing administrator validation is owned by `src/server/middleware/auth.ts:203`; public exceptions are owned by `src/server/desktop.ts:5`.

## Requirements

- R1: Every request resolving to a protected `/api/` route must run the existing administrator authentication and IP policy, regardless of static path encoding or HTTP method.
- R2: Successful administrator authentication must execute the existing authenticated administrator limiter exactly once. Rejected authentication must not consume that limiter or reach the business handler.
- R3: Desktop health and OAuth callbacks retain their public behavior, including query strings and equivalent encoded static segments. Proxy routes retain their independent authentication.
- R4: Preserve the existing authentication errors, limiter policy, registration order, and normal management API behavior. Keep one production guard shared by executable tests.
- R5: Add regression coverage that fails against the vulnerable behavior, verify the server build/type check and repository architecture guardrails, and document deployment limitations.

## Acceptance Criteria

- AC1 (R1): Plain and encoded protected management reads and writes reject missing credentials with 401; incorrect administrator credentials and a rejected client IP return the existing 403 responses. Protected handlers are never invoked in these cases.
- AC2 (R2): Correct credentials and an allowed IP reach protected handlers; normal and encoded requests share the administrator rate-limit bucket and receive 429 after its configured limit.
- AC3 (R3): Public health checks and OAuth callbacks remain available without administrator credentials, including requests with query strings. Proxy requests still require their own credentials, and ordinary unknown API paths retain rejection/not-found handling without revealing protected data.
- AC4 (R4): Production startup and behavioral tests use the same guard. An architecture assertion protects guard registration after the retired-route guard and before API registration.
- AC5 (R5): Relevant regression suites, `npm run typecheck:server`, `npm run build:server`, and `npm run repo:drift-check` pass. Verification records distinguish a local fix from deployment and historical data exposure.

## Out of Scope

- Production configuration changes, deployment, remote pushes, and rotation of real credentials.
- Database/schema, frontend, proxy protocol, and backup-format changes.
- A wider security audit or changes to the existing forwarded-IP trust policy.

## Constraints

Use UTF-8 without BOM and preserve unrelated untracked scaffolding and diagnostic artifacts. Do not run long Docker/WSL experiments. Keep the service private until a repaired image is independently deployed and verified; local remediation does not establish whether past disclosure occurred.
