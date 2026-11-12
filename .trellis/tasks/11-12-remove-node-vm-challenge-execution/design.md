# Design: Data-Only Challenge Parsing

## Scope and Owners

| Concern | Owner after this change |
| --- | --- |
| Challenge detection, string-table decoding, `arg1`/mapping parsing, XOR solve, cookie retry | `src/server/services/platforms/newApiShield.ts` |
| Adapter delegation only | `src/server/services/platforms/newApi.ts` (`solveAcwScV2` becomes a one-line delegate) |
| Enforcement rule | `scripts/dev/repo-drift-check.ts` (`no-node-vm-execution`) |
| Regression tests | `src/server/services/platforms/newApiShield.test.ts` (new), `scripts/dev/repo-drift-check.test.ts` (extended) |

No other module changes. `anyrouter.ts` inherits `NewApiAdapter.solveAcwScV2`,
so both platform names are covered by the `newApi.ts` edit.

## Chosen Approach

Port the upstream v1.3.1 implementation instead of writing a new parser. It is
already validated against the fork's own fixture (identical `acw` output), it is
the reference implementation of the same product, and it keeps the fork's
challenge behavior aligned with upstream for future merges.

Rejected alternatives:

- Keep `node:vm` but harden the sandbox (frozen host object, `Object.create(null)`,
  no injected host functions). Rejected: `node:vm` is documented as "not a
  security mechanism"; the process would keep a code-execution primitive whose
  safety depends on sandbox details that a future edit can silently weaken.
- Re-implement the page's base64 table decoder in a hand-written minimal parser.
  Rejected: duplicated logic, no upstream reference to test against.
- Solve the challenge by calling the page's functions through a bundled JS
  engine dependency. Rejected: new dependency, same "execute upstream script"
  risk class.

## Contract

`solveNewApiAcwScV2(html: string): string | null` remains the only exported
solver. Internals:

1. `parseChallengeArg1(html)` — unchanged regex, uppercased hex or `null`.
2. `parseChallengeMapping(html)` — unchanged regex (`for(var m=[...],p=L(0x115)`),
   numeric array or `null`.
3. `parseChallengeXorSeed(html, expectedLength)` — new signature. Locates the
   page's string table, decodes each single-quoted literal with the case-swapped
   base64 decode, keeps entries whose decoded text has `length === expectedLength`
   and matches `/^[0-9a-f]+$/i`, and returns the single candidate or `null`.
4. Ordering in `solveNewApiAcwScV2`: `arg1` and `mapping` are validated first;
   the seed parse runs only with `expectedLength = arg1.length`; a `null` seed
   returns `null` before any reorder/XOR work. This matches upstream and removes
   the current behavior where the seed parser runs before the validity guard.
5. Reorder-by-mapping and XOR stay byte-identical to the current local code.

Decoding is data-only: `Buffer.from(caseSwapped, 'base64')` never evaluates
input.

Measured during implementation, and left unfixed by decision: the planning claim
that the regexes are safe on any input was wrong. They do not backtrack
exponentially, but both the table pattern and the pre-existing mapping pattern
are **quadratic** in input length when a body repeats an unterminated array
opener, because the leading literal anchor matches at every repeat while
`[^\]]*` scans to the end each time. Measured on Node 25 (real 4321-byte
fixture: 0.01 ms):

| Crafted body | table scan | mapping scan |
| --- | --- | --- |
| 8 KB | 3.7 ms | 4.3 ms |
| 64 KB | 353 ms | 440 ms |
| 128 KB | 1 091 ms | 1 199 ms |
| 1 MB | 64 981 ms | 107 291 ms |

A size bound was implemented and then **withdrawn at user review** to keep strict
parity with upstream v1.3.1; see D6. The quadratic cost therefore ships as a
known residual risk, recorded in a source comment and in Residual Risks below,
and needs a separate task.

## Data Flow After the Change

```
upstream HTTP body
  -> isShieldChallenge(content-type, text)        (unchanged)
  -> solveNewApiAcwScV2(text)
       -> parseChallengeArg1    (regex, data)
       -> parseChallengeMapping (regex, data)
       -> parseChallengeXorSeed (regex + base64 decode, data)
       -> reorder by mapping, XOR with arg1      (pure arithmetic)
  -> upsertCookie(cookieHeader, <shield cookie>, acw)
  -> retry up to 3 attempts                        (unchanged)
```

No `eval`, `Function`, `node:vm`, child process, or dynamic import on this path.

## Decisions

- D1 (default): port upstream's parser verbatim, including the
  "exactly one candidate" rule as the fail-closed condition.
- D2 (default): delete the duplicated private parsers in `newApi.ts` entirely
  rather than leaving them unused; `solveAcwScV2` delegates to the shared
  function so the two sinks cannot drift apart again.
- D3 (resolved as default — warning kept): one `console.warn` fires when a shield
  challenge was detected but no unique seed could be parsed. **Placement changed
  during implementation**: the plan put it in `fetchJsonWithShieldCookieRetry`,
  but it is implemented inside `solveNewApiAcwScV2` instead. Two reasons: the
  second retry loop lives in `newApi.ts` (`fetchJsonRawWithCookie`) and would not
  have been covered by a shield-module-only warning, and inside the solver the
  warning fires precisely when `arg1` and `mapping` parsed but the seed was
  absent or ambiguous — the case worth reporting — rather than on every `null`.
  The warning contains no response content. `console.warn` matches the module's
  existing logging convention (the repo has no logger abstraction).
- D4 (default): extend the existing drift checker instead of adding a bespoke
  architecture test. The rule is scoped to `src/server/**` non-test source, which
  also keeps stale copies under `.codex/**` (and `dist/`, `scripts/`) out of the
  rule, so the checker's current "0 violations" ratchet stays honest.
- D5 (default): do not add a `dist/` rebuild to the commit; `dist/` is untracked
  and `docker/Dockerfile` rebuilds from source. The task records the rebuild
  requirement in `implement.md` and verifies the local build output once.
- D6 (**withdrawn**): a `MAX_CHALLENGE_HTML_LENGTH = 64 * 1024` entry guard was
  implemented after measuring the quadratic cost above, then removed at user
  review. The user's decision: D6 exceeded the approved PRD, and this slice must
  align strictly with upstream v1.3.1, which has no bound. The guard, its warning,
  and the three tests that covered it (oversized body, crafted quadratic body,
  page padded to the limit) were deleted; the solver now does exactly what
  upstream does. The measured DoS is unmitigated and tracked as separate work, not
  silently dropped: it is recorded in a comment above the table pattern, in the
  Residual Risks list, and in the follow-up list of the upstream parity research
  note. Deferring it is defensible because it is a bounded availability issue on an
  operator-configured host, while the RCE this task removes was arbitrary code
  execution; bundling an unreviewed divergence into a security fix would be the
  worse trade.

## Enforcement Rule Spec

- `ruleId`: `no-node-vm-execution`
- `description`: "Server code must not execute untrusted input through node:vm"
- `fileFilter`: `src/server/**` and not a `.test.*` file
- `lineMatch`: `VM_MODULE_SPECIFIER_PATTERN` — static `from 'node:vm'`, bare
  `import 'node:vm'`, dynamic `import('node:vm')` and `require('node:vm')`, each
  also in the un-prefixed `'vm'` form and with either quote style. It must not
  match the bare identifiers `createContext` / `runInContext`: eleven modules
  under `src/server/transformers/**` legitimately define functions with those
  names (verified by grep before writing the rule).
- `message`: "server module imports node:vm; node:vm is not a sandbox, parse
  untrusted input as data instead"
- severity: `violation` (no allowlist)

## Compatibility and Rollback

- Behavior: identical solver output on the fixture; no change to exported
  signatures, headers, cookies, or retry counts. Error handling changes for one
  input class: a recognized challenge whose table yields zero or multiple
  length-matching seed candidates now fails closed with one warning (D1 + D3)
  instead of relying on vm evaluation. Callers already handle a `null` solve by
  skipping the cookie retry, so no call site changes.
- Configuration/database: none touched.
- Rollback: revert the commit. Note that a revert also restores the demonstrated
  RCE and the event-loop DoS, so a rollback requires network containment of
  configured upstreams until the fix is re-applied.

## Residual Risks

- A live page whose table yields zero or multiple length-matching candidates now
  returns `null` and stops cookie retry. Fixture coverage is the only evidence
  that real pages match this shape; D3 makes the failure visible.
- **Unmitigated, by decision (withdrawn D6):** a hostile upstream can block the
  event loop with a crafted body, because both regex scans are quadratic and
  nothing bounds the input. Measured 65 s plus 107 s at 1 MB, and the body is
  read fully into memory by the caller first. `isShieldChallenge` makes this
  easy to reach: it treats any HTML body containing `var arg1 =` as a challenge,
  so up to three attempts per request pay the cost. This is a denial of service
  against the process, not just a wasted retry. Precisely how this compares to
  the old code: the mapping scan was and still is unconditional, so that half is
  pre-existing and unchanged. The table scan is new — the old solver located the
  table with linear `indexOf` calls — but it only runs after `arg1` and the
  mapping both parse, so reaching it requires a body that already looks like a
  valid challenge. Net effect: the cheap-to-reach quadratic path is unchanged,
  and a crafted valid-looking challenge now pays a second quadratic scan. Needs a
  separate task: either bound the body or make both patterns linear.
- The threat model still includes plain-HTTP sites without certificate pinning:
  after this change a MITM can influence challenge parsing but cannot execute
  code.

## Verification Strategy

- Unit: ported `newApiShield.test.ts` (vm-call log empty, tampered page marker
  not executed, fail-closed cases).
- Behavioral: existing `newApi.test.ts` and `modelPricingService.anyrouter.test.ts`
  challenge flows unchanged.
- Static: new drift rule plus its unit test; `npm run repo:drift-check`.
- Build: `npm run typecheck:server`, `npm run build:server`, then assert no
  `node:vm` in `dist/server`.
- Evidence: command outputs recorded in `verification.md`.
