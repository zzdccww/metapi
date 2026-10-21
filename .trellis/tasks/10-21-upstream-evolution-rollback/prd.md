# Restore the pre-update product experience

## Goal

Restore the UI interactions and product behavior available before the recent
integration from `https://github.com/yswlww/metapi-evolution`. The user reports
that the updated features are incomplete and the new UI lost earlier
interactions.

## Background and evidence

- The final request in session `01a15b96-0062-7440-b3c5-bcac76dc2a38` is to
  roll back that upstream update; it was not yet handled.
- Integration merge `5398f46` has local first parent
  `67326f477d1d08ac47b882b922aa43c261cbaefc` and upstream second parent
  `674db2e7ce478119e7e3546dd735befc6610ce95`.
- Current HEAD is `e284c73`, with no tracked source modifications. Unrelated
  untracked local tooling and validation files are present and must be preserved.
- Independent local fixes include encoded management-route authentication
  (`4422852`, already in the first parent) and administrator IP/token hardening
  (`63eba8c`, after the merge).
- The previous comparison found no upstream database schema or migration
  changes. The prior dependency graph had 24 audit findings, including four
  high-severity production dependencies; the integration resolved those findings.
- Production was verified on the integrated version at
  `https://metapi.zzdccww.qzz.io/`, using Northflank and the mutable image tag
  `ghcr.io/zzdccww/metapi:metapi-evolution`.
- On 2026-10-21 the user approved creating this rollback task and entering
  planning, then explicitly approved the recommended scope: restore the old UI
  and feature experience while retaining security patches and existing data.

## Requirements

- R1: Restore the previous default UI and its interactions, using the existing
  `src/web` page/component implementation from the pre-update local baseline.
  Remove the incomplete Evolution UI from the delivered product and build chain.
- R2: Preserve independent local database/startup and administrator security
  fixes, including trusted-proxy policy, strict Bearer validation, safe token
  comparison, startup credential validation, and encoded management-route guards.
- R3: Preserve stored accounts, sites, tokens, routes, settings, and all other
  existing data. Do not introduce a schema downgrade or destructive migration.
- R4: Use a new reviewable rollback commit and retain existing Git history.
- R5: Validate the chosen scope with appropriate tests, type checks, build,
  dependency audit, static delivery/auth checks, and representative UI paths.
- R6: Prepare deployment instructions and retain the current deployed image
  identity as a recovery point. Production changes require applicable user
  authorization after a concrete verified result is available.
- R7: Preserve valid browser administrator sessions established through the
  updated UI and redirect supported `/legacy/` and `/app/` bookmarks to the
  corresponding original pages. Existing missing API/assets behavior remains
  intact.

## Acceptance criteria

- A1 (R1): `/` and supported page deep links load the pre-update interface;
  representative site/account/route/settings interactions remain available,
  including editors, filters, batch actions, and mobile navigation. The built
  product contains one interface and no Evolution assets.
- A2 (R2): Forged forwarding headers do not bypass the administrator IP policy;
  malformed/old credentials and encoded management routes retain their guards.
- A3 (R3): The schema and migration artifacts remain unchanged and startup with
  representative existing settings succeeds without changing real user data.
- A4 (R4): The patch and new commit identify the original merge and baseline,
  without resetting branch history or including unrelated local files.
- A5 (R5): Relevant automated checks pass and remaining verification limitations
  are explicitly recorded.
- A6 (R6): Deployment/recovery notes identify the service, tag, expected UI, and
  required post-deployment checks.
- A7 (R7): A valid stored Evolution session can open the restored interface;
  mapped old/new bookmarks reach their original-page equivalents and retain
  query parameters. Admin failures clear the session; upstream proxy 401/403
  responses do not.

## Confirmed decisions

- Restore the product experience, not the old vulnerable dependency graph.
  Retain patched npm/pnpm constraints and their required TypeScript/runtime
  compatibility adaptations.
- Retain shared auth-session migration and administrator-failure classification
  as transition/security behavior; they do not require keeping the new UI.
- Use a new focused rollback commit on `metapi-evolution`, preserving the
  integration and subsequent security repair in history.
- This is one coordinated build/delivery rollback, not independently deployable
  feature tasks. It does not require a parent/child task tree.

## Out of scope

- Repairing or redesigning the incomplete Evolution interface.
- Changing DNS, administrator credentials, proxy routing business rules, or
  production data as part of preparing the rollback.
- Remote history rewriting or deleting unrelated untracked files.
- Unrelated dependency upgrades, Node-major changes, or desktop packaging work.

## Verification limits and review gate

Historical audit/deployment results establish the starting point, not candidate
verification. Re-run the relevant checks against the implementation. Linux
container availability must be probed; record a concrete limitation if local
Docker/WSL is still unavailable. External live-schema tests must use isolated
databases or remain disabled.

Product scope and the complete technical/execution plan were explicitly approved
by the user on 2026-10-21. Task activation preceded implementation. Candidate
verification and limitations are recorded in `verification.md`.
