# Research: Upstream v1.3.1 Security Fixes vs Local Fork (parity audit)

Audit date: 2026-11-12, branch `metapi-evolution`. Companion file:
`vm-exposure-audit.md` (the node:vm finding this task implements).

## 1. What upstream v1.3.1 contains

Tag `v1.3.1`, commit `14eadaff`, 2026-11-10. Tag message: "security: v1.3.1 —
fix admin auth bypass, remove node:vm upstream execution, harden
X-Forwarded-For handling (#634)". Three fixes:

| # | Upstream fix | Local status |
| --- | --- | --- |
| 1 | Admin auth bypass on encoded paths (route-identity based guard, `apiPath.ts` normalization) | Covered by an equivalent fix (commit `4422852` lineage). Access-control equivalent; residual differences are defense-in-depth only (see §2). |
| 2 | Remove `node:vm` execution of upstream challenge script | **Missing locally — proven exploitable.** Implemented by this task. |
| 3 | Harden `X-Forwarded-For` handling (drop `trustProxy: true`, validated proxy list) | Independently fixed locally (commit `63eba8c`). One medium env-name divergence remains (see §4). |

Confidence: high for the tag content (tag message + PR #634 public contract +
upstream sources read from a checkout of the tag).

Evidence limit: issue #629's body is private, so item 1 was verified against
PR #634's public contract and upstream `apiPath.test.ts`, not against the
reported payload. The upstream app was never executed; both sides were probed
through `app.inject` only. Confidence: medium for exact payload equivalence.

## 2. Route-guard parity (item 1)

Local guard uses `request.routeOptions.url ?? request.url` (matched-route
identity) in `src/server/index.ts:220,222`; upstream additionally normalizes the
raw target and rejects non-origin-form targets with 400.

Probe results (local fork):

- 11/11 matched admin-route requests → 401, zero handler executions. Access
  control equivalent to upstream.
- 19 unmatched path forms diverge (local SPA 200 / 404 vs upstream 401) but
  reach no handler — defense-in-depth only.
- 4 forms are over-blocked (401).
- Absolute-form request targets are routed locally (admin forms still 401; the
  already-public `/api/oauth/callback/:provider` executes) where upstream
  answers 400.

One overstated claim from the audit was corrected on review: "local is never
looser" is false in a narrow case — an `X-Forwarded-For` hop of `::1` combined
with an IPv4 trusted proxy and loopback in `ADMIN_IP_ALLOWLIST` returns 200
locally vs 403 upstream. Requires a loopback allowlist entry to matter.

## 3. node:vm (item 2)

See `vm-exposure-audit.md`. Summary: critical RCE in two code paths, plus an
event-loop DoS, reachable from unattended schedulers.

## 4. Proxy / client-IP parity (item 3)

Local state: `trustProxy: false` unless `TRUSTED_PROXY_IPS` is set
(`src/server/config.ts:245`, `parseTrustedProxyIps` at 81-93 rejects invalid
entries with `Invalid TRUSTED_PROXY_IPS entry: ... Use explicit IP addresses or
non-universal CIDRs`). `extractClientIp` was deleted in commit `63eba8c`; auth,
runtime-settings `currentAdminIp`, allowlist self-lockout checks and per-IP
limiter identities all use Fastify's `request.ip`.

Probes: default configuration plus `X-Forwarded-For: 203.0.113.7` → `request.ip`
is the peer → 403 (header ignored, correct). With the proxy declared → the
forwarded address is honoured → 200; an appended real client address wins.

Residual findings:

- **Medium — environment name divergence.** Upstream renamed the variable to
  `TRUSTED_PROXIES`; the fork reads `TRUSTED_PROXY_IPS`. An operator following
  upstream documentation silently gets `trustProxy: false` (fails safe, but
  hides the misconfiguration). Needs either an alias or an explicit migration
  note. Confidence: high.
- **Low — documentation.** `docs/deployment.md` has no reverse-proxy trust
  callout equivalent to upstream's.
- **Low — shared with upstream.** Trusted-CIDR pass-through means any client
  inside a trusted range can choose its own identity for rate limiting.
- **Low.** The global limiter identity is socket-bound, so clients behind one
  NAT can share a bucket.

One audit claim was rejected: "upstream silently accepts `0.0.0.0/0`" is wrong —
`@fastify/proxy-addr` 5.1.0 rejects prefix 0 and non-IP values at construction.

## 5. Dependencies

| Package | Local | Upstream v1.3.1 | Severity / note |
| --- | --- | --- | --- |
| fastify | 5.12.5 | 5.12.8 | low (GHSA-389g-gv7q-r4x8, fixed in 5.12.6). A moderate advisory was single-source and unreachable (no `handlerTimeout` configured). |
| @fastify/static | 10.1.6 | 10.1.10 | moderate, glob path, low exploitability given local `wildcard: false`. |
| find-my-way | 9.9.0 | 9.10.0 | no advisory; robustness/perf only. |

Local manifest version ranges already admit the fixes; only the lockfile lacks
them. Local-only advisories outside v1.3.1's scope: undici 6.29.0 (high,
production), dompurify 3.4.16 (critical, dev), electron 44.7.0 (high),
follow-redirects 1.16.1 (high), joi 18.2.9 (high).

Unresolved: `npm audit` totals differed between two runs of this audit (20 vs
33). Not explained; treat the counts as unreliable and re-derive them before
acting.

Coverage limit: the lockfile was only partially analyzed (fast-uri, a direct
minimatch entry, nodemailer and `@fastify/rate-limit` → ip-address were not
resolved).

## 6. Test and bookkeeping parity

- Missing test files: `src/server/services/platforms/newApiShield.test.ts` and
  any `apiPath.ts`-equivalent test. Both matter: today a vm reintroduction or a
  path-normalization regression passes CI.
- Version bookkeeping: package and UI report 1.4.2 (enforced by
  `repositoryIdentityContract.test.ts`), there is no local `v1.3.1` tag, and
  `deploy/k3s/chart/Chart.yaml:6` still says `appVersion: "1.3.0"`.
- Stale `'1.3.1'` literals in `src/server/routes/api/updateCenter.test.ts`
  (270-271, 297, 876, 890) are currently unexecuted.
- Local is ahead of upstream on many hardening items outside the three fixes
  (admin credential validation, timing-safe comparison, retired-route guard).

## 7. Operator action from PR #634

PR #634 advises rotating all secrets for anyone who ran a build at or below
v1.3.0, because the auth bypass could have exposed them. The fork's
pre-fix builds carry the same exposure plus the node:vm RCE, so the same advice
applies to any deployment of this fork built before the earlier admin-auth fix.
This is an operational action, not a code change; it is recorded here so it is
not lost.

## 8. Remaining work (candidates, not part of this task)

1. This task: remove `node:vm` (critical).
2. `TRUSTED_PROXY_IPS` / `TRUSTED_PROXIES` alias or migration note + a
   `docs/deployment.md` reverse-proxy callout (medium).
3. Lockfile refresh for fastify / `@fastify/static`, then the local-only
   advisories (medium; verify audit counts first).
4. Optional: port upstream path normalization + origin-form 400 rejection and
   its tests (defense-in-depth, low).
5. Test parity: `apiPath`-equivalent tests; version-literal cleanup in
   `updateCenter.test.ts`; k3s `Chart.yaml` `appVersion`.
6. `.codex/**` hygiene (vitest exclude, drift-check walk skip) — separate slice.
   Also covers the flaky 5 s timeout on the drift-check ratchet test, which walks
   that tree.
7. Operator secret rotation for pre-fix deployments (operational).
8. Quadratic regex cost in `newApiShield.ts` (high for availability). Both the
   string-table and mapping patterns degrade to seconds at 64 KB and minutes at
   1 MB on crafted bodies; `isShieldChallenge` makes the path easy to reach. A
   64 KB bound was implemented in this task and withdrawn at user review for
   strict upstream parity, so the exposure ships unmitigated. Upstream v1.3.1 has
   the same weakness, so fixing it means diverging deliberately: bound the body,
   or rewrite both patterns to be linear.
9. No gate type-checks `src/server/**/*.test.ts` (`tsconfig.server.json` excludes
   them, `tsconfig.web.test.json` covers only `src/web`). Repo-wide gate change.

## 9. Confidence and open gaps

High confidence: the three fixes' content, the local node:vm exposure, the
proxy-IP behavior under probe, the access-control equivalence of the route
guard.

Medium: exact payload equivalence for the auth bypass (issue body private);
dependency advisory totals.

Not covered by this audit, carried forward as unknowns: OAuth loopback callback
servers, CORS preflight handling on pre-auth paths, and any behavior that only
appears when the real upstream app runs (both sides were exercised through
`app.inject` only).
