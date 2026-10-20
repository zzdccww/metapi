# Management route authentication design

## Boundary and ownership

The behavior gap is between Fastify's matched route identity and the root guard's raw URL prefix check. Fix the shared management authentication entry point rather than adding individual endpoint checks.

Extract registration into `src/server/middleware/adminRouteGuard.ts` with `registerAdminRouteGuard(app: FastifyInstance): void`. It reuses `authMiddleware`, `createRateLimitGuard`, runtime `config`, and the existing public-route predicate. `src/server/index.ts` invokes this registrar at the existing guard position and no longer owns a duplicate guard/limiter implementation.

For routed requests, classify the matched `request.routeOptions.url`. Only an unmatched request without a matched route identity may use the original URL to preserve existing unknown-path handling. Apply both `/api/` classification and the public exception predicate to the same identity. Do not selectively decode or blacklist one encoding.

## Data flow and contracts

Global limiter -> retired monitor guard -> management route guard -> existing API/proxy handler.

For protected management requests: existing IP/token validation -> stop if reply sent -> existing administrator limiter -> handler. Preserve the `admin-authenticated` bucket, shared `admin` identity, runtime maximum and window, and the existing error payloads. Public desktop health and OAuth callback route identities skip management authentication; proxy handlers retain their own middleware.

No endpoint signatures, settings, dependency versions, database records, or schema contracts change. Using the matched health route identity also keeps health requests with query strings public, consistent with the health endpoint's purpose.

## Test strategy and affected files

- New `adminRouteGuard.test.ts`: run Fastify injection against the production registrar and real administrator authentication/limiter, with synthetic route handlers and test configuration. Cover several static-prefix encodings; GET/POST/PUT/DELETE; missing/wrong/correct tokens; denied IP; shared limiter; public health/OAuth; unknown paths; proxy controls. Assert handler invocation as well as status. Avoid real accounts, database reads, network listeners, or deployment requests.
- `globalRateLimit.test.ts`: replace duplicated management guard wiring with the production registrar where applicable; update the source-based startup-order assertion so extraction cannot silently drop enforcement.
- `index.ts` and the new guard module contain the necessary product-code change; the parent session owns a short security spec and final verification record.

Existing tests/source conventions govern mocking and cleanup. Restore runtime configuration and reset limiter state between tests. Any further file change must be justified by a discovered regression in this same scope.

## Alternatives and compatibility

Rejected: a per-backup check misses other management reads/writes; encoding blacklists miss equivalent inputs; changing the entire API plugin tree is broader than necessary. A small shared registrar provides behavioral testing of the actual production implementation without bootstrapping the full application/database.

Retain registration order and public endpoint behavior. Do not add configurable auth overrides or new generic extension points. Broader forwarded-IP trust issues are separate from this routing defect.

## Rollout and rollback

Server rebuild and a newly deployed image are required; the running image is not repaired by changing this checkout. No environment-variable or migration change is required. Keep Northflank private while building and verifying a repaired image. A rollback to the vulnerable revision requires network containment and cannot be described as a security-safe state. Real credential revocation remains an operational follow-up outside this local change.
