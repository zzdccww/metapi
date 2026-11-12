# Remove node:vm Execution of Upstream Challenge Script

## Goal

Remove every code path that executes JavaScript taken from an upstream HTTP
response and replace it with upstream v1.3.1's data-only challenge parser, so a
malicious or compromised configured upstream can no longer run code inside the
metapi server process.

Context: upstream metapi v1.3.1 (tag commit `14eadaff`, 2026-11-10, PR #634)
shipped this as one of three security fixes ("remove node:vm upstream
execution"). The fork already carries the other two fixes in equivalent form;
this one is still missing and was proven exploitable during the 2026-11-12
parity audit.

## Reported Findings (verified during the audit)

1. Critical, remote code execution. `src/server/services/platforms/newApiShield.ts:70-95`
   slices two regions out of the upstream response body and runs them through
   `createContext(sandbox)` / `runInContext(..., { timeout: 100 })` where
   `sandbox = { decodeURIComponent }` (a host object). A contextified host
   object leaks the host realm, so inside the script
   `this.constructor.constructor('return process')()` returns the host
   `process`. Demonstrated: the payload read the repository `package.json` and
   wrote files on the host; end-to-end over HTTP it executed on all three retry
   attempts. Reproduced independently against the real module.
2. Critical, second sink. `src/server/services/platforms/newApi.ts:3,411-436,438-464`
   duplicates the same solver and is reached from `fetchJsonRawWithCookie`
   (`newApi.ts:750`). A probe drove `NewApiAdapter.getBalance` against a
   malicious HTTP endpoint and executed the payload 204 times.
3. Medium, event-loop denial of service. The seed decoder is invoked after
   `runInContext` returns (`newApiShield.ts:89`, `newApi.ts:430`), outside the
   100 ms timeout. A malicious `a0j` (`while(true){}`) hung the probe process
   until `timeout 10` killed it (exit 124).
4. Reachability. The body comes from `site.url` / `baseUrl` of a configured
   site; `src/server/routes/api/sites.ts:108` accepts plain `http:` and no
   certificate pinning was found. Automatic paths: checkin cron
   (`checkinScheduler.ts:161-166`), balance refresh (`balanceService.ts:300`),
   model discovery (`modelService.ts:1184,1212`), pricing refresh
   (`modelPricingService.ts:447,910`), per-request usage fallback
   (`proxyUsageFallbackService.ts:409`). Threat model: malicious or compromised
   configured upstream, or an inline MITM of a plain-HTTP site. No downstream
   API credential is required.
5. Portability. The upstream parser reproduces the local solver's output on the
   checked-in fixture (`src/server/services/platforms/__fixtures__/anyrouter-challenge.html`,
   expected `acw = 699dbedad126579b6bc0ebb91eaae8d7af3548b5`) and fails closed on
   a missing table or two plausible seeds.
6. Regression gap. `src/server/services/platforms/newApiShield.test.ts` does not
   exist locally, so nothing fails if a vm-based solver is reintroduced.
7. Rule gap. `scripts/dev/repo-drift-check.ts` has no rule forbidding `node:vm`
   in server source, so the boundary is documentation only.

## Requirements

- No server code path may execute script extracted from an upstream response.
  The challenge string table is decoded as data.
- Solving behavior on the existing fixture must be identical and the existing
  behavioral challenge tests must stay green.
- Parsing fails closed: return `null` unless exactly one decoded table entry
  matches the expected length and parses as lowercase hex.
- A security regression test must assert that `node:vm` is never called and that
  a tampered challenge page cannot execute payload code.
- The "no `node:vm` in server source" rule must be executable in
  `scripts/dev/repo-drift-check.ts` and covered by its test.
- Preserve the cookie-retry contract (`fetchJsonWithShieldCookieRetry`, the
  shield cookie handling and its three attempts), the public API surface,
  database contracts and configuration.
- Record verification evidence, including that built output no longer contains
  the vm solver.

## Acceptance Criteria

- `grep -rn "node:vm" src/server` returns no non-test hit.
- `src/server/services/platforms/newApiShield.test.ts` exists and passes: empty
  vm-call log, a marker planted in the page's helper/rotate regions is never
  set, and the fail-closed cases return `null`.
- Existing challenge tests pass unchanged: `src/server/services/platforms/newApi.test.ts`,
  `src/server/services/modelPricingService.anyrouter.test.ts`.
- `repo:drift-check` reports 0 violations, and the new rule fires in
  `scripts/dev/repo-drift-check.test.ts` for a synthetic `src/server/**` file
  importing `node:vm`.
- `npm run typecheck:server` passes.
- `npm run build:server` succeeds and `grep -r node:vm dist/server` is empty.
- No new dependency, no configuration change, no request/response contract
  change, no database change.

## Open Decision (resolved at the planning review gate)

`design.md` D3: emit one warning when the retry path detects a shield challenge
but cannot parse a unique seed. Rationale: this change turns that path
fail-closed, which silently disables cookie retry if a live page has a different
table shape than the fixture. `implement.md` defaults to including a single
`console.warn` without page content. Veto at review for byte-for-byte upstream
parity.

**Resolved as the default (warning kept)** — the review approved the plan without
vetoing D3. Implemented inside `solveNewApiAcwScV2` rather than in
`fetchJsonWithShieldCookieRetry` as the plan sketched, because a shield-module-only
warning would miss the second retry loop in `newApi.ts`; see design.md D3 for the
full reasoning. The warning carries no response content.

A second decision, D6, was added **during implementation and beyond this PRD**,
then **withdrawn at user review**: `MAX_CHALLENGE_HTML_LENGTH = 64 * 1024` would
have bounded the body before any regex scan, after measurement showed both the
new table pattern and the pre-existing mapping pattern are quadratic on crafted
input (65 s + 107 s of event-loop blocking at 1 MB). The user ruled that this
slice aligns strictly with upstream v1.3.1, so the guard and its three tests were
removed. The scope of this PRD is therefore met exactly, with no divergence from
upstream; the measured DoS is carried forward as separate work and recorded in
design.md Residual Risks.

## Out of Scope

- Renaming or aliasing `TRUSTED_PROXY_IPS` to upstream's `TRUSTED_PROXIES`
  (medium migration risk; separate task).
- Porting upstream `apiPath.ts` normalization and the origin-form 400 rejection
  (defense-in-depth only; audit verified no protected handler is gated by it).
- Dependency upgrades (fastify 5.12.8, `@fastify/static` 10.1.10, undici 6.29.1,
  dompurify 3.4.17, electron 44.9.1, follow-redirects 1.16.2, joi 18.3.1).
- `dist/` hygiene, `.codex/**` test pollution, stale version literals in
  `src/server/routes/api/updateCenter.test.ts`, k3s chart `appVersion`.
- Operator secret-rotation guidance: recorded in the audit report as an
  operational action, not a code deliverable here.
