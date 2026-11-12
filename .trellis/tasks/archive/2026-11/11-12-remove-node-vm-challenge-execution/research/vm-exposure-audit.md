# Research: node:vm Exposure in the New-API Shield Solver

Audit date: 2026-11-12. Branch `metapi-evolution`. Evidence gathered with a
read-only audit plus local reproductions; no repository file was modified.

## 1. The two sinks

| Sink | Location | Entry point |
| --- | --- | --- |
| `newApiShield.ts` | import at line 2; sandbox at 84-86; parser at 70-95; call order at 97-101 | `fetchJsonWithShieldCookieRetry` (line 245) |
| `newApi.ts` | import at line 3; sandbox at 425-427; parser at 411-436; solver at 438-464 | `NewApiAdapter.solveAcwScV2` (line 750, inside `fetchJsonRawWithCookie`) |

Both take two regions of the upstream response body, `createContext(sandbox)`
with `sandbox = { decodeURIComponent }` (a **host** object), and run the regions
with `runInContext(..., { timeout: 100 })`. The seed decoder `a0j` is then
invoked from the host **after** `runInContext` returns, so that call is outside
the timeout.

## 2. Mechanism (reproduced)

`node:vm` is documented as "not a security mechanism" — it constrains
`require`/globals, not the object graph. With a contextified host object,
`this.constructor` inside the script is the host `Object`, hence:

```js
this.constructor.constructor('return process')()
```

returns the **host** `process`. Only `Object.create(null)` sandboxes
(`contextExtensions` off) avoid this. Verified on Node 24.13.1 and reproduced
against the repository module: the payload read the repository `package.json`
and wrote files on the host.

End-to-end over HTTP, an independent verifier drove a configured site whose
response body was a challenge page with a payload helper function and observed
the payload execute on all three retry attempts. A second probe called
`NewApiAdapter.getBalance` against a malicious HTTP endpoint and counted 204
payload executions.

Confidence: high (mechanism reproduced twice, independently).

## 3. Availability impact (reproduced)

With a benign `arg1`/table but a hostile helper that defines `a0j` as
`while(true){}`, the post-`runInContext` invocation hangs the Node event loop.
Probe result: process killed by `timeout 10` with exit 124, i.e. the whole
server process stalls, not just the request.

Two audit claims were checked and **rejected** by the verifier and must not be
repeated: (a) "the 100 ms timeout bounds the CPU cost" — false, the decoder call
is outside it; (b) "the executed script can persist state after it returns" —
no reliable persistence was shown, `gc` restored the `arrayBuffers` baseline.

## 4. Reachability of the sinks

The body comes from `site.url` / `baseUrl` of a configured site. Plain `http:`
is accepted (`src/server/routes/api/sites.ts:108`) and no certificate pinning
was found. Automatic, unattended paths that reach the solver for any such site:

- `src/server/services/checkin/checkinScheduler.ts:161-166`
- `src/server/services/balanceService.ts:300`
- `src/server/services/modelService.ts:1184,1212`
- `src/server/services/modelPricingService.ts:447,910`
- per-request usage fallback `src/server/services/proxyUsageFallbackService.ts:409`
- adapter-level `getBalance` via `newApi.ts:750`

Threat model: a malicious or compromised configured upstream, or an inline MITM
of a plain-HTTP site. No downstream API credential is required.

## 5. Upstream fix contract (v1.3.1)

Upstream removed the execution path in the same release that fixed the admin
auth bypass and the `X-Forwarded-For` handling (tag message: "security: v1.3.1 —
fix admin auth bypass, remove node:vm upstream execution, harden X-Forwarded-For
handling (#634)", commit `14eadaff`, 2026-11-10). Its replacement:

- `CHALLENGE_STRING_TABLE_PATTERN` / `CHALLENGE_STRING_LITERAL_PATTERN` —
  regex extraction of the page's string table.
- `decodeChallengeTableEntry` — case-swapped base64 decode via `Buffer.from`,
  pure data.
- `parseChallengeXorSeed(html, expectedLength)` — returns a seed only when
  exactly one decoded candidate matches `expectedLength` and `/^[0-9a-f]+$/i`;
  `null` otherwise (fail closed).
- `solveNewApiAcwScV2` validates `arg1` and `mapping` **before** the seed parse.
- `newApiShield.test.ts` asserts `node:vm` is never called and that a tampered
  page cannot execute (`globalThis.__metapiShieldTestMarker` stays undefined).

Portability check performed locally: the upstream parser returns
`699dbedad126579b6bc0ebb91eaae8d7af3548b5` on the checked-in fixture
`src/server/services/platforms/__fixtures__/anyrouter-challenge.html`, identical
to the current vm-based solver, and returns `null` for a missing table and for
two plausible seeds. Confidence: high.

## 6. Local delta and gaps

- Fork-specific code that must be preserved when porting:
  `collectSetCookieHeaders(headers: { get(name): string | null; getSetCookie?: () => string[] })`
  in `newApiShield.ts:197-205` (upstream types it as `Headers`).
- Missing locally: `newApiShield.test.ts`. Nothing fails if a vm solver is
  reintroduced; the only challenge coverage is behavioral
  (`newApi.test.ts:626,700`, `modelPricingService.anyrouter.test.ts:80`).
- `scripts/dev/repo-drift-check.ts` has no rule forbidding `node:vm`, so the
  boundary was documentation-only.
- `dist/server/services/platforms/newApi{Shield,}.js` in the working tree are
  untracked, gitignored build output; `docker/Dockerfile` rebuilds them from
  source (`npm run build:server`), so an image is never built from stale dist.
  A local `npm start` without a rebuild would keep executing the old solver.

## 7. Residual risk after the planned change

- A live challenge page whose table yields zero or multiple length-matching
  candidates now fails closed, silently disabling cookie retry (design D3 makes
  it observable).
- `isShieldChallenge` still classifies any HTML body containing `var arg1 =` as
  a challenge, so a hostile upstream can still force wasted retries; cost is
  bounded by response size and unchanged by this task.
- MITM of a plain-HTTP site can still influence parsed values (e.g. steer the
  solve result), but cannot execute code.
