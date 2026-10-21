# Management Route Authentication

## Scope and Trigger

Read this contract before changing management authentication, proxy trust,
administrator credential startup/rotation, public API exceptions, retired-route
classification, or server hook registration. Issue #629 exposed a mismatch: Fastify
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
- `buildConfig(env)` and `buildFastifyOptions(appConfig)` in `config.ts` own
  explicit proxy trust; consumers use `normalizeClientIp(request.ip)` from
  `shared/clientIp.ts`.
- `parseAdminBearerToken(authorization: string): string | null`,
  `timingSafeTokenEqual(actual: string, expected: string): boolean`, and
  `assertSafeAdminCredentials(config): void` in `shared/adminCredentials.ts`
  own administrator credential syntax, equality, and deployment validation.

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
authentication and must not consume the administrator bucket. No database
migration is required.

### Client identity and explicit proxy trust

`TRUSTED_PROXY_IPS` accepts a comma-separated, trimmed, deduplicated list of
literal IPv4/IPv6 addresses or CIDRs. Blank/unset means `trustProxy: false`.
Reject invalid entries, empty list items, booleans, numeric hop counts, named
networks and `/0`; do not silently ignore or widen trust. Pass validated lists
to Fastify. Fastify 5.12.5 disables numeric hop trust; explicit addresses also
identify whether the immediate peer can be trusted.

Authorization, runtime settings `currentAdminIp`, allowlist self-lockout checks,
and default per-IP rate-limit identities must use Fastify's `request.ip`.
Do not extract a separate identity from `X-Forwarded-For`. Shared normalization
retains mapped IPv4 and `::1` compatibility. Global limits remain socket-bound;
authenticated administrator/proxy identity buckets remain unchanged.

Trusted proxies must overwrite forwarding headers or append the observed peer.
Only traverse trusted peers from the right; the first untrusted hop determines
the client. Never configure administrator client addresses as proxy addresses.
Update maintained env/Compose/hosted templates together and restart after changes.

### Administrator credentials and startup

Require a case-insensitive Bearer scheme followed by spaces and one nonempty
token without whitespace or commas. Bare tokens, other schemes, embedded
prefixes and multiple credentials reject with the existing 403 payload and
authentication failure marker. Token comparison uses SHA-256 fixed-size digests
and Node `timingSafeEqual`; UTF-16LE preserves exact JavaScript strings. No stale
expected-token digest cache is allowed across runtime rotation.

After `applyRuntimeSettings(finalMap)` and outside its recovery catch, call
`assertSafeAdminCredentials(config)` before Fastify construction/listen. A saved
non-default `auth_token` works without env `AUTH_TOKEN`. A saved empty string must
hydrate so validation rejects it instead of silently selecting a fallback.
Blank tokens and tokens containing whitespace/commas fail. Production server
mode rejects `change-me-admin-token` even on loopback. Desktop/development allow
it only on literal `127.0.0.1` or `::1`; desktop defaults to `127.0.0.1`. External
desktop binds require a non-default token.

`POST /api/settings/auth/change` uses the shared timing-safe old-token check and
validates the proposed new token before persistence; failed rotation changes
neither settings nor runtime credentials. Preserve the minimum six-character
requirement. Factory reset preserves the current valid administrator token.
Do not change account credential encryption fallback or proxy credential forms.

### Retired routes

The retired monitor guard rejects matched identity
`request.routeOptions.url ?? request.url` and raw retired paths. This blocks
encoded registered routes while keeping unmatched/wildcard retirement intact.
Never selectively decode URL strings. Synthetic registered retired handlers
must remain uncalled; no real retired handlers are registered for tests.

## Validation and Error Matrix

| Protected request condition | Response | Handler called? |
| --- | --- | --- |
| IP rejected by existing allowlist policy | 403, `{ error: 'IP not allowed' }` | No |
| Allowed IP, missing authorization | 401, `{ error: 'Missing Authorization header' }` | No |
| Allowed IP, incorrect administrator token | 403, `{ error: 'Invalid token' }` | No |
| Allowed IP, bare/malformed administrator credential | 403, `{ error: 'Invalid token' }` | No |
| Allowed IP and token, available limit | Existing handler response | Yes |
| Allowed IP and token, exhausted limit | 429, existing limiter payload and `retry-after` | No |

These outcomes apply to plain and encoded matched routes for every registered
HTTP method. Unmatched plain `/api/` URLs retain authentication before not-found
handling; unmatched encoded URLs must not reveal protected handler output.

| Startup/rotation condition | Required result |
| --- | --- |
| Direct/untrusted peer forges an allowed XFF client | 403 IP rejection; no handler |
| Declared proxy appends the real allowed client | Normal authenticated response |
| Production server uses missing/default effective token | Throw before listening |
| Desktop/development loopback uses default token | First-login compatibility |
| Any mode externally binds with default token | Throw before listening |
| Saved private token, env AUTH_TOKEN absent | Startup succeeds with saved token |
| Saved empty/whitespace token | Throw before listening |
| Rotation to whitespace/comma token or unsafe default | 400; no persisted/runtime change |
| Encoded matched retired endpoint | 404; no handler |

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

Include direct spoofing, trusted/untrusted peers and intermediate hops, an
injected leftmost header, IPv4/IPv6 and mapped CIDRs. Settings and limiter tests
must prove forged headers cannot alter display, self-lockout or per-IP buckets.
Shared credential tests cover unequal lengths and exact Unicode/surrogate
equality without unreliable wall-clock assertions. Rotation tests prove old
credentials stop working and invalid new credentials never persist.

`adminAuthentication.architecture.test.ts` protects startup ordering and bans raw
forwarding extraction in IP consumers. Synthetic built-server startup smoke uses
fresh SQLite fixtures and private test tokens; exclude operator env/live DB URLs.
Assert unsafe startup never listens, valid saved credentials work without an env
token, and plain/encoded routes enforce identical credentials. Close fixture DB
connections before deletion. Also run desktop typecheck/build and deployment
example tests when changing listen/configuration contracts.

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

// Wrong: a direct client chooses its IP and bare tokens pass.
const clientIp = request.headers['x-forwarded-for'];
const token = authorization.replace('Bearer ', '');

// Correct: the configured framework owns trust, shared helpers own credentials.
const clientIp = normalizeClientIp(request.ip);
const token = parseAdminBearerToken(authorization);
const valid = token !== null && timingSafeTokenEqual(token, config.authToken);
```

A checkout change requires rebuilding and deploying the repaired server artifact
before a running service is protected. Local tests do not establish whether any
historical disclosure occurred. Rolling back to the vulnerable version requires
network containment.
