# Implementation: Remove node:vm Challenge Script Execution

## Preconditions

- Task status is `in_progress` (`python ./.trellis/scripts/task.py start`) — only
  after this plan has been reviewed and confirmed by the user.
- Land the whole slice as one commit. It touches exactly:
  `src/server/services/platforms/newApiShield.ts`,
  `src/server/services/platforms/newApi.ts`,
  `src/server/services/platforms/newApiShield.test.ts` (new),
  `scripts/dev/repo-drift-check.ts`, `scripts/dev/repo-drift-check.test.ts`.
- Run every gate through the repo check runner so Node 25 and the DB-parity
  environment are handled:
  `python docs/plans/upstream-evolution-run-check.py <label> "<command>"`.
  It unsets `DB_PARITY_MYSQL_URL` / `DB_PARITY_POSTGRES_URL`, sets
  `DB_PARITY_SKIP_LIVE_SCHEMA=true` and `NODE_ENV=test`, prepends the task-local
  Node 25 binary (`docs/plans/upstream-evolution-runtime/.../node.exe`, repo
  requires `>=25.0.0`), and logs to `docs/plans/upstream-evolution-checks/<label>.log`.
- Every vitest invocation passes `--exclude ".codex/**"`; stale copies under
  `.codex/` otherwise break the run.
- Reference implementation (read before editing, do not guess):
  `https://raw.githubusercontent.com/cita-777/metapi/v1.3.1/src/server/services/platforms/newApiShield.ts`
  (parser at lines 69-99, `solveNewApiAcwScV2` at 101-128) and the matching
  `newApiShield.test.ts`.
- No `npm install`, no dependency change, no `.env` edit, no `git push`.

## Step 1 — Port the data-only parser into newApiShield.ts

1a. Delete line 2: `import { createContext, runInContext } from 'node:vm';`.
1b. Replace the current `parseChallengeXorSeed` (lines 70-95, the sandbox block)
    with the upstream data-only implementation:
    `CHALLENGE_STRING_TABLE_PATTERN`, `CHALLENGE_STRING_LITERAL_PATTERN`,
    `decodeChallengeTableEntry` (case-swapped base64 decode to utf8), and
    `parseChallengeXorSeed(html, expectedLength)` returning the single decoded
    candidate whose `length === expectedLength` and which matches
    `/^[0-9a-f]+$/i`, else `null`.
1c. Update `solveNewApiAcwScV2` (lines 97-101) to upstream ordering: parse `arg1`,
    then `mapping`, then call `parseChallengeXorSeed(html, arg1.length)`; return
    `null` on any miss before the reorder/XOR work.
1d. Keep unchanged: the fork's `collectSetCookieHeaders(headers: { get; getSetCookie? })`
    structural typing, the shield cookie name, retry count and error handling.
1e. Check: `grep -n "node:vm" src/server/services/platforms/newApiShield.ts` is empty.

## Step 2 — Collapse the duplicate solver in newApi.ts

2a. Delete line 3 `import { createContext, runInContext } from 'node:vm';`; keep
    the `solveNewApiAcwScV2` import from `./newApiShield.js` (line 5).
2b. Delete the private `parseChallengeArg1`, `parseChallengeMapping`,
    `parseChallengeXorSeed` and their bodies (lines 392-464); reduce
    `private solveAcwScV2(html: string): string | null` to
    `return solveNewApiAcwScV2(html);`.
2c. Grep each deleted name across `src/server/` to prove no other caller remains.
2d. Confirm the only call site (`this.solveAcwScV2(text)` around line 750 inside
    `fetchJsonRawWithCookie`) is untouched.
2e. Check: `grep -rn "node:vm" src/server` returns nothing.

## Step 3 — Regression test

3a. Create `src/server/services/platforms/newApiShield.test.ts` ported from
    upstream, using the checked-in fixture `./__fixtures__/anyrouter-challenge.html`:
    - `vi.mock('node:vm')` wrapper that records `createContext` / `runInContext`
      calls while delegating to the real module.
    - case 1: `solveNewApiAcwScV2(html)` and the adapter's `solveAcwScV2(html)`
      both return `699dbedad126579b6bc0ebb91eaae8d7af3548b5`, and the vm call log
      is empty.
    - case 2: tampered page (marker statement injected into the helper and rotate
      regions) leaves no global marker set and still logs no vm call.
    - case 3: fail-closed — `arg1`-only page returns `null`; page with an emptied
      string table returns `null`; page with two length-matching candidates
      returns `null`.
3b. Optional per design D3 (open at review): in `fetchJsonWithShieldCookieRetry`,
    log exactly one `console.warn` when a shield challenge is detected and the
    solver returns `null`. Message must not include response content. Verify no
    existing test asserts console output on that path
    (`grep -rn "console.warn" src/server/services/platforms/`) before adding.
    If review vetoes D3, skip 3b entirely.

## Step 4 — Executable rule in the drift checker

4a. Add rule `no-node-vm-execution` to `createRules()` in
    `scripts/dev/repo-drift-check.ts`, matching the existing rule shape:
    `fileFilter` = `src/server/**` excluding `*.test.*`, `lineMatch` = static
    import `from 'node:vm'` / `from "node:vm"`, dynamic `import('node:vm')`, and
    `require('node:vm')`. Severity `violation`, message per `design.md`.
    Do not match bare `createContext` / `runInContext` identifiers — unrelated
    modules in `src/server/transformers/**` legitimately define functions with
    those names.
4b. Extend `scripts/dev/repo-drift-check.test.ts`: synthetic workspace with
    `src/server/example.ts` importing `node:vm` must produce exactly one
    `no-node-vm-execution` violation; the same import inside
    `src/server/example.test.ts` must produce none.
4c. Existing ratchet test ("keeps the current repository within the first-wave
    ratchet") must still see `violations === []` — it is the proof the rule does
    not fire on the current tree or on `.codex/**` copies.

## Step 5 — Spec update (Phase 3, do not defer)

5a. Add `.trellis/spec/backend/upstream-response-safety.md`: upstream HTTP
    response bodies are data. Script extracted from a response must never be
    executed; challenge parsing must be data-only and fail closed; `node:vm` is
    banned in `src/server/**` source and the ban is enforced by
    `scripts/dev/repo-drift-check.ts` rule `no-node-vm-execution`.
5b. Add its row to `.trellis/spec/backend/index.md`.

## Step 6 — Gates and evidence

Run in this order (labels shown are the runner labels):

1. `typecheck-server` — `npm run typecheck:server`
2. `node-vm-focused-tests` —
   `npx vitest run src/server/services/platforms/newApiShield.test.ts src/server/services/platforms/newApi.test.ts src/server/services/modelPricingService.anyrouter.test.ts scripts/dev/repo-drift-check.test.ts --exclude ".codex/**"`
3. `drift-check` — `npm run repo:drift-check`
4. `build-server` — `npm run build:server`, then
   `grep -rn "node:vm" dist/server` (expect no match) and
   `grep -c "CHALLENGE_STRING_TABLE_PATTERN\|parseChallengeXorSeed" dist/server/services/platforms/newApiShield.js`
   (expect a non-zero count, proving the shipped artifact carries the data-only parser).

Existing behavioral gates that must stay green without edits:
`src/server/services/platforms/newApi.test.ts` (challenge cases around 626 and
700) and `src/server/services/modelPricingService.anyrouter.test.ts` (around 80).

Write `verification.md` in this task directory: per-gate command, exit status,
the decisive output line, plus an explicit list of what was NOT run (full test
suite, live upstream challenge page, Docker image build) and why.

## Step 7 — Cleanup and handoff

- Delete audit scratch artifacts: `/tmp/vm-mech-check/`,
  `%LOCALAPPDATA%/Temp/v131-de-critic.txt`, and the upstream comparison checkout
  `%LOCALAPPDATA%/Temp/metapi-upstream-compare/` once steps 1-5 no longer need
  the reference copy.
- Confirm no `tmp-review-*` directories were left in the repo by earlier tooling.
- Record `git status --short` in `verification.md`.
- Do not commit here: commit message and staging are step 3.4 with user
  confirmation.

## Rollback

- R1 (after steps 1-2): `git checkout -- src/server/services/platforms/newApiShield.ts src/server/services/platforms/newApi.ts`.
- R2 (after step 4, full slice): `git revert <commit>` — note that this restores
  the demonstrated RCE and the event-loop DoS, so after a revert keep configured
  upstreams on trusted HTTPS only and re-apply the fix.
- `dist/` is untracked and rebuilt from source by `docker/Dockerfile`
  (`npm run build:web && npm run build:server`); no rollback action needed there
  beyond rebuilding.

## Review Gates

- Gate A (planning): user confirms `prd.md` + `design.md` + `implement.md` and
  resolves D3. Only then `task.py start`.
- Gate B (after step 2): focused challenge tests pass with the new parser before
  the rule/test work starts.
- Gate C (after step 6): all four gates green plus `verification.md` written,
  then review the diff as a unit before commit.
