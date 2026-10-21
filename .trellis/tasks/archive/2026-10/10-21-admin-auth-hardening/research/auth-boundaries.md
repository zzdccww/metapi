# Authentication Boundary Evidence

Baseline: `7fe1cf8`, source work commit `5398f46`.

R1 family: two settings callers use the auth helper's first raw forwarded IP:
currentAdminIp (`settings.ts:847`) and allowlist lockout checking
(`settings.ts:911,1650-1662`). Default per-IP limits independently parse raw
forwarding in `requestRateLimit.ts:39-51`. Fix these owners together. Global
limits already use socket identity through `resolveProxyAuthSocketAddress`;
authenticated administrator limits use `admin`. Preserve those buckets.

No timing-safe helper exists under src/scripts. Token rotation repeats plain
equality in `routes/api/auth.ts:36`. A neutral shared verifier should serve
both administrator request and old-token checks; proxy credential forms remain
separately owned.

Fastify's installed `lib/request.js:getTrustProxyFn()` supports explicit
IP/CIDR lists and deliberately returns a false function for numeric hop trust.
Do not assume the old numeric-hop API still establishes trustworthy forwarding.
Default false plus explicit proxy IP/CIDR configuration gives a testable boundary.

Saved `auth_token` is applied by `runtimeSettingsHydration.ts` after effective
database loading (`index.ts:183-185`), before constructing Fastify. A default
credential startup check must run after this hydration. Do not demand an
environment key when the effective saved token is non-default.

Desktop first login relies on `change-me-admin-token` (README.md:265-266), binds
0.0.0.0 by default (`src/desktop/runtime.ts:33,39`), and uses production mode
when packaged (`src/desktop/main.ts:227`). This requires an explicit compatibility
decision. Account credential encryption fallback can depend on AUTH_TOKEN;
changing its default is outside this task.

Retirement guard should consider matched request.routeOptions.url and raw path.
Tests must register synthetic retired handlers and prove percent-encoded static
segments cannot invoke them. Keep raw retired namespace checks for unknown paths
and wildcard fallback routes instead of blindly discarding the raw identity.

## Bug Analysis: Administrator Identity and Credentials

### 1. Root Cause Category

- E (implicit assumption): unconditional proxy trust assumed all peers passed
  through a proxy that sanitized forwarding headers.
- B (cross-layer contract): auth, settings and limits each selected identities
  independently; credential syntax and deployment mode were not shared contracts.
- D (test gap): direct forged headers and encoded synthetic retired handlers had
  no integration regressions.

### 2. Why the Earlier Repair Did Not Cover This

The upstream management-route fix repaired router identity (#629). The proxy
trust, plain token comparison and default-token deployment behavior were
pre-existing adjacent contracts, outside that earlier change's acceptance matrix.
No runtime timing claims are inferred from passing functional tests.

### 3. Prevention Mechanisms

| Priority | Mechanism | Action | Status |
| --- | --- | --- | --- |
| P0 | Framework identity | Default proxy trust false; explicit IP/CIDR lists; all affected consumers use request.ip | Done |
| P0 | Credential owner | Strict Bearer parsing, fixed-size timing-safe digest comparison, post-hydration startup gate | Done |
| P1 | Executable regressions | Trusted/untrusted chains, settings self-lockout, IP limiter buckets, rotation, matched retirement | Done |
| P1 | Real artifact smoke | Fresh SQLite and built server check rejection before listen and persisted-token compatibility | Done |
| P1 | Architecture/spec | Protect hydration ordering and ban raw forwarding extraction in affected consumers | Done |

### 4. Systematic Expansion

Reviewed all production config.authToken setters. Factory reset preserves the
current valid credential. Rotation validates before settings/runtime changes.
Hydration now preserves saved empty strings for explicit rejection rather than
falling back silently. Global socket and authenticated identity buckets remain
owned by their existing modules. Proxy credentials and account encryption retain
their existing independent contracts.

### 5. Knowledge Capture

Updated `.trellis/spec/backend/management-route-auth.md` and its index with
environment wiring, startup/rotation/error matrices and regression requirements.
`src/templates/markdown/spec/` does not exist in this application, so template
sync from the generic Trellis skill does not apply.

## Execution Fallback

Trellis implement/check sub-agent dispatch failed with unsupported inherited
`deepseek-v4-flash`. The main session completed implementation and full-scope
review; no model configuration override was used. Context-mode MCP tools were
not exposed; bounded local analysis and file-backed rtk command logs were used.
