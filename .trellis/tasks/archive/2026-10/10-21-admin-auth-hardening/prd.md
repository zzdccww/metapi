# Administrator Authentication Hardening

## Goal

Repair the administrator authentication weaknesses reported after upstream
integration, preserving matched-route authorization and valid proxy deployments.
The user approved task creation and repair on 2026-10-21.

## Reported Findings

1. Medium, pre-existing: unconditional proxy trust in `src/server/config.ts:226`
   and direct first-value `X-Forwarded-For` selection in `middleware/auth.ts:177`
   let a token holder spoof the administrator IP allowlist. The user's example
   sends `198.51.100.7` from loopback and changes 403 to 200.
2. Low, pre-existing: administrator token equality uses ordinary string
   comparison in `middleware/auth.ts:217`; token rotation repeats this in
   `routes/api/auth.ts:36`.
3. Credential parsing accepts bare tokens via `.replace('Bearer ', '')`
   (`middleware/auth.ts:216`); missing `AUTH_TOKEN` uses the documented default
   `change-me-admin-token` (`config.ts:95`).
4. Low, latent: `retiredMonitorRouteGuard.ts:22` checks raw URL identity. Encoded
   variants could escape the guard if a retired route were registered again.

## Requirements

- Explicit, bounded proxy trust; use Fastify's resolved client identity in
  administrator authorization, settings IP display and allowlist lockout checks.
- One timing-safe verifier for administrator request tokens and token rotation;
  require a valid Bearer scheme and reject bare or malformed credentials.
- Prevent the public default administrator token from securing an externally
  reachable server, using the compatibility policy confirmed below.
- Router-aligned retirement checks, preserving existing unknown-path behavior.
- Regression coverage of spoofed forwarding headers, valid trusted proxy chains,
  malformed credentials and encoded retired routes.
- Preserve public endpoints, proxy authentication ownership, administrator
  rate-limit composition and database contracts.
- Record configuration compatibility and executable verification evidence.

## Acceptance Criteria

- Reported header spoofing fails for direct/untrusted clients, while explicitly
  trusted proxy IP/CIDR chains still resolve valid client addresses.
- Settings IP display, lockout validation and ordinary per-IP limits cannot
  select an identity from raw forwarding headers. Preserve global socket and
  authenticated-identity buckets.
- Correct Bearer token succeeds. Bare, empty, embedded-prefix, incorrect,
  shorter/longer and same-byte-length incorrect tokens reject without exceptions;
  token rotation uses the same verifier.
- Matched encoded retired routes return 404 without invoking synthetic handlers;
  public/proxy exceptions and neighboring API/SPA paths retain behavior.
- Server typecheck/build, focused regressions and architecture drift pass;
  verification uses synthetic credentials and isolated data.

## Confirmed Decisions

Default proxy trust is false. Configure only explicit proxy IP/CIDR lists through
a documented environment setting; reject unconditional trust and hop counts.
The installed Fastify version deliberately disables numeric-hop trust because
it cannot identify a direct untrusted peer. Prefer proxy networks that operators
actually control, and require proxies to overwrite or append forwarding headers.

The user confirmed the default-token policy: reject missing/default effective
credentials for production server startup after saved settings hydration.
Retain desktop/development first-login compatibility only on loopback and
adjust desktop's default listen host to loopback. A valid saved auth_token remains
usable without an environment AUTH_TOKEN. Do not generate random per-boot tokens
or change the account credential encryption fallback.

Production server mode always rejects the default token, including loopback
binds. Desktop and development retain the default only on literal `127.0.0.1`
or `::1`. Explicit external desktop binds require a non-default token. Empty or
whitespace-only effective tokens fail startup. Operator documentation must not
present a reverse-proxied default-token debug service as secure local operation.

The existing body-limit/config tests and development helpers must supply an
explicit loopback bind or non-default token when constructing secure server
options. Saved-token hydration and token rotation remain supported.

## Out of Scope

Remote push, production deployment, real-user credentials or databases,
unrelated authentication providers and broad proxy protocol changes.
