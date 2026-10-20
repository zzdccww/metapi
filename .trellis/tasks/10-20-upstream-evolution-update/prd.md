# Sync reviewed upstream Evolution updates

## Goal

Bring the local deployment source up to the reviewed upstream revision, remove known dependency vulnerabilities, and provide the new Evolution interface while preserving existing local fixes.

## Background and Approval

- Baseline: local `67326f477d1d08ac47b882b922aa43c261cbaefc`; upstream `674db2e7ce478119e7e3546dd735befc6610ce95`; common ancestor `2b4b8968f1e01d5d37249775744c132b89e70648`.
- Reviewed comparison: `docs/plans/upstream-update-comparison-2026-10-20.md`. Six upstream commits are missing; fifteen local commits must remain.
- The user approved the presented update recommendation with “同意更新”, then approved task creation and continuation with “允许创建并继续更新（推荐）”. This task persists that reviewed scope without a material change or unresolved product decision.

## Requirements

1. Incorporate all six reviewed upstream commits through the pinned revision, including the default Evolution UI, the `/legacy/` interface, shared sessions, auth-origin handling, security dependencies, and Electron/TypeScript adaptations.
2. Preserve schema column ownership filtering, matched-route administrator authentication and limits, Docker npm compatibility, and the local GHCR branch image workflow.
3. Resolve the static-header conflict using the Fastify reply contract and retain functioning static delivery and SPA reserved-path handling.
4. Audit the updated complete and production dependency graphs against the official npm registry; correct remaining update-related vulnerabilities within existing supported dependency lines when practical.
5. Validate compilation, source tests, Evolution-specific checks, architecture drift, browser fixture smoke, and the Docker deployment path where local tools permit. Record exact limits when a platform-specific check cannot run.
6. Keep actual production accounts, databases, services and deployments untouched during validation.

## Acceptance Criteria

- [ ] The upstream revision and baseline local revision are both retained in the integrated history.
- [x] Encoded management routes enforce credentials and the shared administrator limiter; public/proxy controls retain their behavior.
- [x] Schema introspection skips metadata without base-table owners and preserves valid table metadata.
- [x] The built interface serves Evolution at `/` and the reference interface at `/legacy/`; browser fixture checks cover core interaction and session paths.
- [x] Dependency audits have no unresolved findings; root complete/production and standalone frontend audits are zero.
- [x] Applicable type checking, build, regression tests and drift checks pass; environmental skips are distinguished from passing tests.
- [x] Existing Docker npm pin and GHCR workflow remain functional source configuration, with the new frontend source trigger added.
- [ ] Changes, validation, runtime limitations and rollback reference are recorded and locally committed.

## Out of Scope

Remote push, production deployment, real-account integration tests, live schema resets/migrations, unrelated UI redesign, and full desktop release/multi-architecture publishing. Desktop source compilation remains in scope; actual release packaging is supplementary validation.
