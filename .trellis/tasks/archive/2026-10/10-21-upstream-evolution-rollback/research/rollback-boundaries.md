# Rollback boundaries and recovered session

## Evidence sources

The final user message in session
`01a15b96-0062-7440-b3c5-bcac76dc2a38` requests rollback of the recent
`yswlww/metapi-evolution` update because its new features are incomplete and the
new UI lacks previous interactions. No assistant response or rollback followed
that message. Earlier implementation, push, Northflank verification, and DNS
repair were already completed.

- Current source: `e284c737b56c2b10d0cac3f8bb9796383f65f1b4`.
- Integration merge: `5398f4647060e7412286e81c3b25732eb73dbb13`.
- First parent / pre-update local baseline:
  `67326f477d1d08ac47b882b922aa43c261cbaefc`.
- Second parent / integrated upstream:
  `674db2e7ce478119e7e3546dd735befc6610ce95`.
- Independent post-integration administrator repair:
  `63eba8c747e1e27ceaf8b08dffcf2cd9cef1f0e4`.
- Encoded management-route repair `4422852` is already in the first parent.
- Related task artifacts:
  `.trellis/tasks/archive/2026-10/10-20-upstream-evolution-update/` and
  `.trellis/tasks/archive/2026-10/10-21-admin-auth-hardening/`.
- Historical comparison:
  `docs/plans/upstream-update-comparison-2026-10-20.md`.
- Deployment record:
  `docs/plans/online-deployment-verification-2026-10-21.md`.

## What changed

First-parent tree comparison finds 209 changed files: 137 Evolution UI files,
29 server files (mostly tests and narrow type adaptations), nine original-UI
files, eleven task/spec files, and 23 build/dependency/documentation files.
Only three original-UI production files changed: `src/web/main.tsx`,
`src/web/api.ts`, and `src/web/authSession.ts`. The original `App.tsx`, pages,
components, and interaction logic remain present. `src/web/main.tsx` added the
`/legacy` router basename; Vite now selects Evolution by default and builds the
original UI under `/legacy/`.

The pre-update configuration selected `src/web` directly and output to
`dist/web`. Restoring that experience is feasible without reverting the
security dependency graph. Scope options require a user decision; presence of
an old shell alone does not satisfy a request to roll back the whole update.

Runtime server changes are limited to frontend selection/cache, administrator
failure markers, and compatibility adjustments in Antigravity, image requests,
New API shield, and proxy debug tracing. Inspect adjustments individually before
removal if newer TypeScript/Node typings and dependencies are retained.

## Safety and compatibility

An unqualified `git revert -m 1 5398f46` would also undo security dependency
upgrades and may conflict with the independent administrator repair in
`src/server/index.ts`, `src/server/middleware/auth.ts`, Docker workflow tests,
README files, Docker compose, and backend spec index. Historical task paths were
archived after the merge. Prefer a new focused rollback commit preserving
history and local task records.

The old dependency graph had 24 audit findings: one critical, eight high,
twelve moderate, three low. Its production graph had twelve findings,
including four high-severity packages (`brace-expansion`, `minimatch`,
`nodemailer`, `undici`). These are results recorded on 2026-10-20, not a fresh
audit of the proposed rollback. The integrated root and standalone UI graphs
were audited as zero on 2026-10-21. Retaining their patched constraints avoids
deliberately restoring documented vulnerable versions; audit the candidate
again during implementation.

The schema contract, migration history, and generated schema artifacts have no
differences between `67326f4` and current HEAD. Database test cleanup changes do
not alter production schema. No destructive migration is needed. Test only
isolated fixtures and preserve real user data.

Administrator invariants remain owned by config, runtime hydration, shared
credential/IP helpers, and the matched-route guard. Frontend rollback must
preserve saved administrator tokens, trusted proxy configuration, strict Bearer
parsing, timing-safe comparison, startup policy, limiter identity, and retired
or encoded route protection. Existing shared session support can ease returning
users' transition; determine its final form after the scope decision.

Static delivery must keep no-cache entry documents, immutable hashed assets,
and JSON 404s for missing API/proxy/asset namespaces. A previous UI deployment
must not retain a stale Evolution bundle because of partial build output.

## Deployment evidence and limits

Northflank service:
`https://app.northflank.com/t/zzdccwws-team/project/metapi/services/metapi`.
Public custom domain: `https://metapi.zzdccww.qzz.io/`.
Image tag: `ghcr.io/zzdccww/metapi:metapi-evolution`.
Previously published manifest:
`sha256:055c468596ee85f24d39f1c233ee92e7904c067038ac98bc980036a35f68e290`.
Previous verification compared actual pod files to the integrated repaired
build; it did not independently measure the running pod's image digest.

Current Docker Desktop/WSL image validation availability has not been rechecked.
Previous local checks used Windows Node 25; production was observed on Node
22.23.3. Keep the documented Node 22 ARMv7 Docker contract and validate native
dependencies separately for each runtime. Publishing rollback source triggers
an image build; require a verified image before production rollout.

Context-mode MCP tools are unavailable in this session. History and Git/file
analysis used bounded local scripts through `rtk proxy`. No product source has
been edited.

## Confirmed scope and second evidence pass

The user explicitly chose the recommended approach on 2026-10-21: restore the
original UI/feature experience and retain security patches and data. The agreed
implementation removes the incomplete UI/build family while keeping patched
dependencies, shared session transition, admin-failure classification, and
required type/runtime adaptations. The user subsequently approved the complete
plan ("批准"); task activation preceded implementation.

`src/web/App.tsx` declares the original routes at lines 862-880: `/`, `/sites`,
`/accounts`, `/oauth`, `/tokens`, `/checkin`, `/routes`, `/logs`, `/monitor`,
`/settings`, `/downstream-keys`, `/events`, `/settings/import-export`,
`/settings/notify`, `/models`, `/playground`, and `/about`. The updated
`src/app/routes.ts` in the Evolution directory supplies `/app/` bookmarks;
mapping those to original routes requires a small transition contract rather
than keeping a second interface.

The reviewed server changes are narrow compatibility adaptations, not new
business features: explicit Undici Headers imports; image headers copied from
entries; New API shield structural header type; structural proxy-debug header
type. Retain them with the patched dependency/type graph. The original pages and
components were not rewritten by the merge.

Root `lucide-react` has no uses in `src/`, `scripts/`, or workflows and belongs
to the new UI; remove only after confirming all tracked uses during implementation.
`typescript-compiler-api` is used by `src/web/i18n.test.ts` and must remain.
Playwright is used by the current Evolution smoke; retain it for original-UI
fixture verification if the smoke is replaced. npm/pnpm security tests are
valuable independently; adapt their manifest enumeration instead of deleting
the guard when the standalone UI lockfile is removed.

The current frontend delivery spec describes two shipped shells. It will be
updated after implementation/check and is intentionally not injected as an
unchanged target contract. The approved task design owns the new single-shell
behavior; existing cache/auth/runtime invariants remain applicable.
