# Management Route Authentication

## Scope and Trigger

Read this contract before changing management authentication, public API
exceptions, or server hook registration. Issue #629 exposed a mismatch: Fastify
matches encoded static segments such as `/%61pi/settings/backup/export` to an
`/api/` route, while a raw URL prefix check skips authentication.

## Signatures and Ownership

- `registerAdminRouteGuard(app: FastifyInstance): void` in
  `src/server/middleware/adminRouteGuard.ts` owns guard registration.
- `authMiddleware(request, reply)` in `middleware/auth.ts` owns existing
  administrator IP and token validation.
- `isPublicApiRoute(url: string): boolean` in `desktop.ts` owns public exceptions.
- `createRateLimitGuard(options)` in `middleware/requestRateLimit.ts` owns the
  authenticated administrator limiter.

Routes must not add parallel authentication implementations. Register the shared
guard after the retired monitor guard and before API plugins in `index.ts`.

## Request and Configuration Contracts

Use `request.routeOptions.url ?? request.url` for both the `/api/` classification
and public exception predicate. The matched route pattern is available in
`onRequest` and reflects Fastify's routing decision. The raw URL fallback preserves
existing unknown-route behavior; it is not an alternative identity for a matched
route. Do not add selective URL decoding or encoding blacklists.

Protected management requests execute IP/token validation first, then the
authenticated administrator limiter only if `reply.sent` is false. Preserve
bucket `admin-authenticated`, identity `admin`, and configuration
`authenticatedRateLimitMax` / `requestRateLimitWindowMs`. Rejected authentication
must neither consume that bucket nor invoke the business handler.

Desktop health and OAuth callback route identities remain public, including
encoded static segments and query strings. Proxy routes keep their own
authentication and must not consume the administrator bucket. This contract adds
no environment variables or database migrations.

## Validation and Error Matrix

| Protected request condition | Response | Handler called? |
| --- | --- | --- |
| IP rejected by existing allowlist policy | 403, `{ error: 'IP not allowed' }` | No |
| Allowed IP, missing authorization | 401, `{ error: 'Missing Authorization header' }` | No |
| Allowed IP, incorrect administrator token | 403, `{ error: 'Invalid token' }` | No |
| Allowed IP and token, available limit | Existing handler response | Yes |
| Allowed IP and token, exhausted limit | 429, existing limiter payload and `retry-after` | No |

These outcomes apply to plain and encoded matched routes for every registered
HTTP method. Unmatched plain `/api/` URLs retain authentication before not-found
handling; unmatched encoded URLs must not reveal protected handler output.

## Good, Base, and Bad Cases

- Base: `/api/settings/backup/export?type=all` requires administrator credentials.
- Good: `/%61pi/settings/backup/export?type=all` has the same authentication,
  IP policy, and administrator bucket as the plain route.
- Public: `/api/desktop/health?source=test` and matched OAuth callback routes
  skip administrator authentication and limits.
- Bad: classifying raw `request.url` allows an encoded management prefix to
  reach a protected handler without any administrator validation.

## Required Tests

Exercise the production registrar with Fastify injection and synthetic handlers;
do not read real backups or credentials. See `middleware/adminRouteGuard.test.ts`.
Assert response payloads and that rejected requests never invoke handlers.
Cover static prefix encodings, management reads/writes, missing/wrong/correct
credentials, rejected/allowed IPs, shared limits, and public/proxy controls.
Restore runtime configuration and reset limiter state between cases.

`middleware/globalRateLimit.test.ts` protects registration order: global limiter,
retired-route guard, management guard, then API registration. Run the focused
auth/limiter/desktop/OAuth/retired-route suites, `npm run typecheck:server`,
`npm run build:server`, and `npm run repo:drift-check` after changing this boundary.

## Wrong and Correct

```typescript
// Wrong: the router accepts encoded static segments absent from this prefix.
const routeUrl = request.url;

// Correct: authentication and public exceptions use the router's identity.
const routeUrl = request.routeOptions.url ?? request.url;
```

A checkout change requires rebuilding and deploying the repaired server artifact
before a running service is protected. Local tests do not establish whether any
historical disclosure occurred. Rolling back to the vulnerable version requires
network containment.
