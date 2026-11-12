# Verification: Remove node:vm Challenge Script Execution

Date: 2026-11-12. Branch `metapi-evolution`, no commit yet (step 3.4 pending).
Every gate ran through `python docs/plans/upstream-evolution-run-check.py <label> <cmd...>`
(Node 25 from `docs/plans/upstream-evolution-runtime/`, `NODE_ENV=test`,
`DB_PARITY_SKIP_LIVE_SCHEMA=true`, live DB-parity URLs unset). Raw logs are in
`docs/plans/upstream-evolution-checks/<label>.log`.

Runner note: the script only rewrites a leading `npm`, not `npx`. The planned
`npx vitest run ...` invocation failed with `FileNotFoundError: [WinError 2]`
before starting; it was re-run as `npm test -- <files>`, which resolves to the
same vitest binary.

## Gate results

| # | Label | Command | Exit | Decisive output |
| --- | --- | --- | --- | --- |
| 1 | `typecheck-parity-final` | `npm run typecheck:server` | 0 | `tsc --noEmit -p tsconfig.server.json` produced no diagnostics (2.7 s) |
| 2 | `node-vm-gates-parity-final` | `npm test -- newApiShield.test.ts newApi.test.ts modelPricingService.anyrouter.test.ts repo-drift-check.test.ts --exclude ".codex/**"` | 0 | `Test Files 4 passed (4)` / `Tests 35 passed (35)` (3.38 s) |
| 3 | `drift-parity-final` | `npm run repo:drift-check` | 0 | `Violations: 0` |
| 4 | `build-parity-final` | `npm run build:server` | 0 | `tsc -p tsconfig.server.json && tsx scripts/dev/copy-runtime-db-generated.ts`, no errors (3.6 s) |

These labels are the final round, after D6 was withdrawn. Earlier rounds in
`docs/plans/upstream-evolution-checks/` (`*-final`, plus `node-vm-shield-test-3`
and `node-vm-drift-rule-test`) describe the superseded tree that still carried
the size guard; the test count there is 37 rather than 35 because of the three
D6 tests since deleted.

Review pass on the implementation found two assertions that could not fail and
one spec paragraph that overstated the code; all three were corrected. The
load-bearing one: the tampered-page test originally planted
`globalThis.marker = true`, which inside a `node:vm` context writes only to the
sandbox global, so the host-side assertion held even against the vulnerable
build. It now plants `this.constructor.constructor('return globalThis')().marker`,
the actual host-realm escape, and the negative control below shows it failing on
the old code.

### One observed flake, not from this change

`node-vm-tests-upstream-parity` (the run before `-2`, same command) failed with
`Test timed out in 5000ms` on the **pre-existing** ratchet test
`keeps the current repository within the first-wave ratchet`. It passed on the
immediate re-run. Measured cause: `runRepoDriftCheck({ root: process.cwd() })`
takes 403–490 ms on this repo across three runs, far under the 5 s limit, so the
timeout was vitest's default budget being consumed by transform plus import under
load (that run reported `import 17.56s` against 4.74 s on the green run). The
test walks the whole tree, including the large untracked `.codex/**`, because
`walkFiles` skips only `.git`, `node_modules`, `dist` and `coverage`. The new
rule contributes to that total but is scoped to `src/server/**` non-test files.
Left unfixed deliberately: raising the timeout or narrowing the walk is a change
to a test this slice does not own. Worth a separate task.

## Artifact assertions after gate 4

- `grep -rn "node:vm" dist/server` → exit 1 (no match).
- `grep -rln "require('vm')\|from 'vm'" dist/server` → no match.
- `grep -c "CHALLENGE_STRING_TABLE_PATTERN\|parseChallengeXorSeed" dist/server/services/platforms/newApiShield.js`
  → `4` (lines 62, 80, 81, 99), so the shipped artifact carries the data-only
  parser: the pattern definition, the function, its use of the pattern, and the
  single call site.
- `grep -c "MAX_CHALLENGE_HTML_LENGTH" dist/server/services/platforms/newApiShield.js`
  → `0`, confirming the withdrawn D6 guard is absent from the artifact as well as
  the source.
- `dist/server/services/platforms/newApi.js`: line 3 imports
  `solveNewApiAcwScV2`, line 385 is `return solveNewApiAcwScV2(html)`, line 648
  is the single call site. No duplicated parser remains.
- Source scan: the only remaining `node:vm` occurrences in `src/` and `scripts/`
  are the test mock in `newApiShield.test.ts` and the drift rule plus its test
  fixtures in `scripts/dev/repo-drift-check*.ts`.

## Negative control (does the test actually fail without the fix?)

Both modified sources were backed up (md5-verified), reverted with
`git checkout --`, and the final 5-test file re-run (label
`node-vm-negative-control-parity`): exit 1 with **all 5 tests failing**:

- `AssertionError: expected [ 'createContext', …(5) ] to deeply equal []` — the
  happy path reached the vm six times.
- `AssertionError: expected true to be undefined` — the injected
  `this.constructor.constructor('return globalThis')()` marker reached the **host**
  realm under the old implementation. This is the audit's RCE finding reproduced
  by the test suite itself, not just asserted in prose.
- `AssertionError: expected [ 'createContext', …(2) ] to deeply equal []` on the
  "missing arg1" case, re-confirming the old code entered the vm **before**
  validating `arg1`/`mapping`.
- `expected "warn" to be called 2 times, but got 0 times` — no fail-closed
  signal existed.
- `AssertionError: expected [ 'createContext', …(2) ] to deeply equal []` on the
  padded page.

An earlier negative control on the superseded 7-test tree
(`node-vm-negative-control-final`) failed 6 of 7; the one test that passed there
was the D6 crafted-body guard, which the old parser satisfied by bailing out
through `indexOf` before the expensive scan. That test no longer exists.

Sources were then restored from backup with matching md5
(`39dd37f57e14ee48ff8ec713bd6442c3` newApiShield.ts,
`9249afb773965facd6b512c7f86c7632` newApi.ts) and `grep -c node:vm` = 0 in both.

## Changed files

```
 M .trellis/spec/backend/index.md
 M scripts/dev/repo-drift-check.test.ts
 M scripts/dev/repo-drift-check.ts
 M src/server/services/platforms/newApi.ts
 M src/server/services/platforms/newApiShield.ts
?? .trellis/spec/backend/upstream-response-safety.md
?? .trellis/tasks/11-12-remove-node-vm-challenge-execution/
?? src/server/services/platforms/newApiShield.test.ts
```

`newApi.ts` is −76 lines (three private parsers and the inline solver deleted).
Other untracked entries in `git status --short` (`.codex/**`, `.agents/`,
`.claude/`, `.trellis/` scaffolding, `.gitattributes`) pre-date this task and are
not part of the slice.

## Scope divergence from the approved plan

None in the committed tree. A size bound (`MAX_CHALLENGE_HTML_LENGTH`, design D6)
was implemented beyond the approved PRD after measuring quadratic regex cost on
crafted input, reported for acceptance, and **withdrawn at user review** in favor
of strict upstream v1.3.1 parity. Removed with it: the guard, its warning, and
three tests (oversized body, crafted quadratic body, page padded to the limit).
One replacement test covers trailing padding, which upstream also handles.

The measured denial of service is therefore unfixed and documented rather than
mitigated — see design.md Residual Risks and the open-risk paragraph in
`.trellis/spec/backend/upstream-response-safety.md`. It needs its own task.

## Not run, and why

- **Full test suite.** Not executed; the slice is scoped to two source modules
  plus the drift checker, and the full suite needs live DB-parity URLs that this
  environment deliberately unsets. Residual risk: an unrelated consumer of the
  two touched modules would not be caught here. Mitigated by the typecheck gate
  plus the repo-wide grep for the deleted symbols.
- **Live upstream challenge page.** No request was made to any configured
  upstream. Evidence for real-page behavior is the checked-in 4321-byte fixture
  only, so "the fix still solves real challenges" holds exactly as far as that
  fixture is representative.
- **Docker image build.** `docker/Dockerfile` rebuilds `dist/` from source; the
  local `npm run build:server` output was inspected instead. A running
  deployment stays vulnerable until its image is rebuilt and redeployed.
- **Exploit re-verification after the fix.** The escape was reproduced during the
  audit against the old code (recorded in `research/vm-exposure-audit.md`); it
  was not re-attempted against the new parser, since there is no longer an
  interpreter to escape from.
