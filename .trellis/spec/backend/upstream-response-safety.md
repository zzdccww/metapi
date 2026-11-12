# Upstream Response Safety

## Scope and Trigger

Read this contract before parsing, decoding, or otherwise interpreting a body
that came from a configured upstream site: platform adapters under
`src/server/services/platforms/**`, pricing and quota probes, and any new
anti-bot or challenge handling. An upstream response body is attacker-controlled
data even when the host is configured by an administrator: the operator may
configure a hostile site, a site may be compromised, and the transport may be a
site proxy outside operator control.

The rule exists because the fork previously executed challenge script through
`node:vm` with a contextified host object. `node:vm` is not a security sandbox;
with any host object in the context, `this.constructor.constructor('return process')()`
reaches the host `process`, which is remote code execution in the server process.
Both call paths were reachable from unattended schedulers, so no administrator
interaction was required.

## Signatures and Ownership

- `solveNewApiAcwScV2(html: string): string | null` in
  `src/server/services/platforms/newApiShield.ts` owns challenge solving. It is
  the single implementation; `NewApiAdapter.solveAcwScV2` delegates to it and
  must not re-implement parsing.
- `parseChallengeArg1`, `parseChallengeMapping`, `parseChallengeXorSeed` and
  `decodeChallengeTableEntry` are private to that module. Do not export them or
  copy them into an adapter.
- `fetchJsonWithShieldCookieRetry(url, options)` owns the shared shield cookie
  retry loop: challenge detection, `Set-Cookie` merging, and the bounded retry
  count. `NewApiAdapter.fetchJsonRawWithCookie` keeps its adapter-local
  equivalent loop; both must delegate solving to `solveNewApiAcwScV2`.

## Parsing Contracts

Never execute upstream-supplied script. `node:vm` is banned in
`src/server/**` non-test source and the ban is executable: rule
`no-node-vm-execution` in `scripts/dev/repo-drift-check.ts` reports a violation
for static `from 'node:vm'`, dynamic `import('node:vm')` and `require('vm')`
forms, in the bare or `node:`-prefixed spelling. The same prohibition applies to
`eval`, `new Function`, and to handing a response body to any other interpreter.
Extract the values you need with explicit parsing and reimplement the
transformation in TypeScript.

Fail closed. If the structure is unrecognized, or the data is ambiguous, return
`null` and let the caller skip the optimistic retry. Specifically, the XOR seed
is accepted only when exactly one decoded table entry has the expected length
and matches `/^[0-9a-f]+$/i`; two plausible candidates must yield `null` rather
than letting the first match win. A recognized challenge (`arg1` and mapping
present) that cannot produce a unique seed emits exactly one `console.warn` so
the degradation is visible; that warning must not include response content. An
unrecognized page returns `null` silently.

Treat regex cost over a body as attacker-chosen. Both the string-table pattern
and the mapping pattern in `newApiShield.ts` are quadratic when a body repeats an
unterminated array opener: measured on Node 25, a real 4.3 KB challenge page
matches in 0.01 ms, while crafted input costs 0.35 s (table) plus 0.44 s
(mapping) at 64 KB and 65 s plus 107 s at 1 MB, blocking the event loop for the
whole process. **This is a known open risk, not a solved one.** A size bound was
written and then withdrawn to hold strict parity with upstream v1.3.1, so no
limit currently exists. When you add a new scan over an upstream body, prefer a
pattern that cannot degrade this way, and do not assume a bound is in place.

Keep protocol handling honest. Do not widen a parser to accept shapes you have
not seen in a real page, and do not treat a successful parse as proof the
upstream is benign.

## Validation Matrix

| Upstream body condition | Required result |
| --- | --- |
| Recognized challenge, one plausible seed | Solved token, no script execution |
| Script injected anywhere in the page | Never evaluated; no global side effect |
| `arg1` or mapping absent | `null`, no further parsing |
| String table empty or seed ambiguous | `null` plus one warning, no retry |
| Valid JSON body | Returned to the caller unchanged |

## Good, Base, and Bad Cases

- Base: a 4.3 KB challenge page solves to its expected cookie value.
- Good: the same page with an injected marker that escapes a vm realm
  (`this.constructor.constructor('return globalThis')()`) fails closed and never
  sets the host marker. A plain `globalThis.marker = true` is not sufficient
  evidence: inside a `node:vm` context it only writes to the sandbox global.
- Bad: passing the page to `runInContext` with a context containing any host
  function. The sandbox boundary does not exist and the process is lost.
- Bad, and currently possible: a multi-megabyte body of repeated array openers.
  It is parsed as data and cannot execute, but it occupies the event loop for
  minutes. See the open risk noted above.

## Required Tests

A change to challenge parsing needs a test that proves data-only handling, not
just the happy path. See `src/server/services/platforms/newApiShield.test.ts`:
it mocks `node:vm` to record `createContext` / `runInContext` calls and asserts
the log stays empty, injects a host-realm escape marker to prove no evaluation,
and asserts the warning count on the fail-closed seed paths.

Verify a new test fails against the old implementation before trusting it. When
this spec was written, reverting the two sources failed every test in the file,
including `expected true to be undefined` for the host marker — the escape is
reproducible from the suite, not only from the audit write-up. Note the shape of
that marker: a plain `globalThis.marker = true` inside a `node:vm` context writes
only to the sandbox global, so a test using it would have passed against the
vulnerable build and proved nothing.

Run `npm run typecheck:server`, the focused adapter suites
(`newApiShield.test.ts`, `newApi.test.ts`,
`modelPricingService.anyrouter.test.ts`), `scripts/dev/repo-drift-check.test.ts`
and `npm run repo:drift-check` after touching this boundary. When the fix is a
security repair, also confirm the built artifact carries it: `dist/` is rebuilt
from source by `docker/Dockerfile`, so a checkout change protects nothing until
the image is rebuilt and redeployed.

## Wrong and Correct

```typescript
// Wrong: node:vm with a host object in the context is not a sandbox.
const context = createContext({ decodeURIComponent });
runInContext(extractedScript, context);

// Correct: decode the data the page carries, reimplement the transform here.
const seed = parseChallengeXorSeed(html, arg1.length);
if (!seed) return null;
```
