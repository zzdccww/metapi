# Execution and verification plan

## Before implementation

- [x] Recover the requested session and identify its last unfinished request.
- [x] Obtain task creation consent and scope decision.
- [x] Inspect first-parent merge diff, original page routes, security repair,
  schema delta, dependency changes, and deployment records.
- [x] Persist converged PRD, technical design, and this execution plan.
- [x] Validate curated `implement.jsonl` and `check.jsonl` manifests (five real
  entries each; `task.py validate` passed).
- [x] Present the latest full plan and receive a subsequent explicit approval
  (user: "批准", 2026-10-21).
- [x] Run `task.py start` after that review; status is `in_progress`.

This is one coherent rollback. No parent/child task split is needed. Use Trellis
implement/check sub-agents after activation, with an `Active task:` prefix and
curated context. Implementation owns the frontend/build/URL/test/docs change;
the main session coordinates, updates specs, commits, and finishes. Sub-agents
must preserve concurrent edits and unrelated local files. If dispatch fails,
record the actual failure and use the documented main-session fallback without
changing the user's model.

## Implementation sequence

1. Load task artifacts, relevant specs, and before-dev guidance. Snapshot the
   tracked working state and confirm the deletion targets are tracked source
   under the exact Evolution UI directory, not unrelated local validation data.
2. Restore the single original build in Vite/package scripts/router bootstrap.
   Remove the tracked incomplete UI and its dedicated configuration, runner,
   discovery, and stale public bundles. Keep local test exclusions/React
   resolution. Preserve the original pages/components and their behavior.
3. Extend the existing frontend routing owner for safe UI aliases and adapt the
   server's not-found registration. Keep the production static cache helper,
   API/asset reserved paths, guards, and startup ordering. Exercise the root
   shell, redirects, query preservation, and missing resources through Fastify.
4. Preserve browser session migration and admin/proxy failure classification;
   update migration naming/comments and regression expectations as necessary.
   No administrator credential changes or production API mutations.
5. Remove unused UI-only dependency entries after usage checks. Regenerate npm
   and pnpm locks through the appropriate package-manager commands, preserving
   patched constraints and overrides. Adapt root security/installer tests to the
   surviving manifest. Keep compiler/runtime adaptations and SQLite cleanup.
6. Align branch workflow paths, compose image, README/current UI docs, and
   Docker workflow tests with the single restored product. Remove obsolete
   current Evolution parity reports while preserving archived task/journal
   history. Replace the removed smoke script with a fixture-based original-UI
   smoke only if needed to cover the delivery risk.
7. Run the validation gate below, resolve regressions within the agreed boundary,
   and obtain an independent full-scope Trellis check. Update the frontend
   delivery spec and verify its contract matches final code/tests.
8. Record verification and deployment/recovery instructions, review/stage only
   task-owned files, commit locally, then finish/archive/journal per workflow.
   Stop before remote publishing or production changes until authorized.

## Validation gate

Use `rtk proxy` and bounded file-backed logs under ignored
`docs/plans/upstream-rollback-checks/`. Reuse the existing Node 25 harness or a
task-local equivalent. Set `DB_PARITY_SKIP_LIVE_SCHEMA=true` and explicitly unset
external-dialect live URLs unless isolated databases are provisioned.

| Area | Required evidence |
| --- | --- |
| Original UI | Baseline comparison of pages/components; representative site/account/route/settings interaction tests |
| Static URL delivery | Root/deep links, alias redirects/query preservation, cache policy, API/assets 404s |
| Session/auth | Existing session migration/expiry, admin-marker vs upstream errors, trusted/untrusted forwarding, strict Bearer/token rotation, encoded and retired routes |
| Schema preservation | No schema/migration/generated-artifact delta; schema introspection and hydration/startup regression tests |
| Types/build | `npm run typecheck`, `npm run build` (web/server/desktop), one root output without Evolution artifacts |
| Test regression | Focused tests first, then `npm test -- --maxWorkers=2 --testTimeout=120000` using the previously established local fixture limit |
| Dependency graph | Official-registry full/production audits, npm install/CI validation, pnpm frozen lock validation, security-floor tests |
| Architecture | `npm run repo:drift-check`, boundary coverage for frontend delivery/aliases |
| Browser fixture | Login/session reuse; original sites/accounts/routes/settings editor controls, filters/batch entry points, navigation and mobile menu without real upstream calls |
| Built server | Fresh local SQLite fixture, preserved effective-token hydration, `/`, supported links/assets, public health and plain/encoded management auth |
| Container | Probe Docker availability; build and fresh-data smoke on actual Node 22 Linux runtime if available, otherwise document precise limit |

Do not add tests that merely restate code. URL transition tests must assert
actual HTTP destinations/status and reserved-path behavior. UI smoke uses
synthetic API responses and no real credentials or provider mutations.

Record failures with reproduction, cause, and next step. After three consecutive
same-class failures, re-evaluate strategy before repeating. Do not widen scope
or raise production timeouts to hide environment/test issues.

## Preservation and commit checks

- `git diff --check` is clean for task edits, accounting for inherited source
  formatting where appropriate.
- No changes to schema/migrations, account encryption, routing/retry policy,
  administrator credentials, or unrelated local tooling.
- Independent database/auth repairs and their regression tests remain present.
- Deleted source is exactly the obsolete UI/build family; no recursive deletion
  touches local snapshots or node runtimes.
- npm/pnpm patched constraints remain synchronized; installer/audit evidence
  refers to the final source, not historical upstream results.
- The delivery spec describes the final one-interface behavior and migration
  aliases, with executable boundary tests.
- Verification lists runtime, platform, logs, skipped checks, and any container
  limitation. Deployment notes name Northflank service, tag/digest/build, health,
  UI/auth checks, and the previously published recovery image.
- Local commit message describes restoring the original UI while retaining
  security repairs and references merge `5398f46` / baseline `67326f4`.

## Rollback of this patch / later deployment

Keep current HEAD and the reviewed local diff until the new commit is verified.
If local implementation must be discarded, restore only this task's tracked
changes; never reset unrelated work. Once committed, reverse the new rollback
commit with a normal history-preserving revert if needed.

Before a later production rollout, verify the newly built Linux image and save
the actual selected digest/current image and a backup. A rollout requires no
schema downgrade or data rewrite. Recover with the retained previous image if
health or UI/auth checks fail. Do not assume that a mutable tag still points at
the earlier recovery manifest.
