# Administrator Authentication Hardening Design

## Boundary and Ownership

The behavior gap is trusting user-supplied forwarding data and accepting loose
administrator credentials. Fix configuration, framework identity consumers and
shared credential verification, not individual API handler wrappers. Keep one
coherent auth-hardening task: the same production startup and route fixtures
verify the four reported findings together.

Expected source owners: `config.ts`, `index.ts`, `middleware/auth.ts`,
`middleware/requestRateLimit.ts`, `routes/api/settings.ts`, `routes/api/auth.ts`,
`retiredMonitorRouteGuard.ts`, `desktop/runtime.ts`, and neutral shared IP/token
helpers when needed. Existing auth/public/proxy behavior remains at its current
owner. No schema, account encryption or migration changes.

## Proxy and Client IP Contract

Introduce `TRUSTED_PROXY_IPS`, a comma-separated list of literal IPv4/IPv6
addresses or IPv4/IPv6 CIDRs. Blank/unset means `trustProxy: false`.
Pass validated address lists to Fastify's supported trustProxy implementation.
Reject malformed entries, boolean trust, numeric hop counts and universal
`/0` ranges with a configuration error; do not silently widen or ignore trust.
No automatic trust of private or loopback address spaces.

After Fastify resolves the forwarding chain, use only `request.ip` for
administrator authorization, settings currentAdminIp and allowlist self-lockout
checks. Preserve existing IPv4-mapped/loopback normalization with one neutral
normalizer if reused by the limiter. Remove manual X-Forwarded-For parsing from
all default per-IP rate-limit paths in this subsystem. Global limiter remains
socket-bound; authenticated admin/proxy identities retain their own buckets.

A trusted proxy must append or replace forwarding headers with the observed
peer IP. Tests include trusted peer + injected extra leftmost header, multiple
trusted proxies and untrusted immediate/intermediate peers. An explicit IP/CIDR
trust story must prevent a direct untrusted peer from choosing its client IP.

## Bearer and Token Verification

Require the Bearer scheme at the beginning of Authorization, case-insensitive,
followed by spaces and one nonempty token without whitespace. Reject bare
tokens, wrong schemes, embedded prefixes, empty tokens and multiple credentials.
Preserve missing-header 401 and rejected-credential 403 plus the existing
administrator auth-failure marker. Leave proxy credential forms untouched.

Add a neutral shared timing-safe equality helper using Node crypto. Compare
fixed-size digests or safely handle unequal Buffer lengths before timingSafeEqual;
avoid ordinary secret equality. Token rotation's oldToken uses the same helper.
Do not cache a stale expected-token digest across runtime rotation. Tests cover
different lengths and equal-byte-length mismatches without wall-clock assertions.

## Effective Credentials and Startup

Validate effective credentials after saved settings hydration and before Fastify
starts listening. Missing/blank effective credentials reject startup. The public
default token rejects production server startup regardless of bind address.
Desktop or non-production debug may use it only with literal loopback binds
`127.0.0.1` or `::1`; desktop's default HOST becomes `127.0.0.1`. Explicit HOST
override remains possible with a non-default effective token.

A persisted non-default auth_token can satisfy validation when environment
AUTH_TOKEN is absent. Do not generate per-boot secrets or alter the account
credential encryption fallback. Keep config construction testable without
starting real databases. If buildFastifyOptions owns the gate, it must receive
the relevant runtime mode and already-hydrated config, and tests must exercise
the same production invocation order.

## Retired Route Identity

Use `request.routeOptions.url` when classifying a matched route, as the existing
admin guard does. Preserve raw retired-path rejection for unmatched/wildcard
paths so adding router identity does not disable current retirement behavior.
No arbitrary URL decoding or encoded-prefix blacklists. Synthetic registered
retired handlers must remain uncalled for encoded static route variants.

## Configuration Delivery and Compatibility

Update `.env.example`, `docker/.env.example`, Compose and every maintained
Compose example to forward TRUSTED_PROXY_IPS with a blank default. Update hosted
deployment templates if their generic environment contract requires it. Add
operator documentation for explicit proxy addresses, startup rejection, saved
token compatibility and desktop loopback/LAN opt-in. No actual operator env,
account, production proxy or deployment is modified.

## Review / Rollback

Validate config/auth/rotation/settings/limiter/retired-route tests, server and
desktop compilation, shared-session regressions and repo drift. Use new local
fixtures for startup rejection/acceptance checks. No live schema suites.
Default-token and proxy-trust changes are intentional compatibility changes.
Record how to set non-default credentials and actual proxy IP/CIDRs before a
later rollout. Reverting this repair restores the reported weaknesses; source
rollback is `7fe1cf8`, with no DB migration rollback required.
