# Validate Node runtimes before release

## Goal

Establish whether the locally committed schema introspection fix (`53d923d`) is ready for the next release-preparation step. Validate the declared Node 25 development/CI path and the existing Node 22 Docker path, and produce a clear account of passes, failures, and unverified deployment conditions.

## Background

- The repair passed 28 schema tests, 8 runtime bootstrap tests, server type checking, and the drift check under local Node `24.13.1`. Independent review passed. These results are not yet evidence for the configured CI or Docker runtime.
- `package.json` declares Node `>=25.0.0`; `.nvmrc:1` pins `25.0.0`; `.github/workflows/ci.yml:23` and release verification use major 25.
- `docker/Dockerfile:1-3` deliberately retains Node 22 for `linux/arm/v7` support. Both builder and final stages use `node:22-bookworm-slim`, and `.github/workflows/release.yml:310-311` still includes ARMv7.
- Docker Desktop, WSL Ubuntu, and Docker WSL distributions are installed. Both local Docker named-pipe endpoints were absent during the read-only check, so container execution has not yet been established.
- The user approved creation, planning, and the final execution plan on 2026-10-03. The task is active on `fix/schema-introspection-startup-crash`.

## Requirements

- R1: Record the intended runtime matrix and its ARMv7 constraint accurately. Preserve existing Node pins, architecture support, and release configuration during verification.
- R2: Run the core tests, complete type checking, complete application build, and drift check under Node 25, with dependencies installed for that runtime in isolation. Include the focused schema regression in the evidence.
- R3: Verify the existing Node 22 Docker build and an isolated local startup smoke test when the local engine is available. If container execution cannot be established, exercise the fix and web/server build with isolated portable Node 22 and explicitly retain the Linux-container validation gap.
- R4: Keep dependencies, generated build output, test databases, and logs isolated from the working checkout and production. Preserve the installed system Node and the checkout's existing Node 24 dependencies.
- R5: Classify failures using command output and reproducible evidence. Distinguish fix regressions, existing project failures, dependency/toolchain issues, and unavailable infrastructure. Produce a release-readiness decision instead of treating skipped or blocked work as passing.

## Acceptance Criteria

- [x] AC1 (R1): The runtime inventory cites the relevant repository files and records exact runtime versions used in verification.
- [x] AC2 (R2, R5): Node 25 core tests, type checking, build, drift check, and focused regression have recorded outcomes; any failure has a reproducible diagnosis and an explicit release impact.
- [x] AC3 (R3, R5): The Node 22 container build and startup have recorded outcomes, or the documented portable fallback is exercised and the unverified container path remains explicit. The engine was available: the real build failed at npm 10 lock validation, so startup was not reached. This criterion records the blocked outcome; it does not assert a passing build or startup.
- [x] AC4 (R4): No tracked product, lockfile, Node-pin, or deployment configuration changes are introduced; isolated resources are cleaned up or named for safe follow-up.
- [x] AC5 (R5): `verification.md` states whether release preparation can proceed and lists remaining blockers and environment limits without claiming production recovery.

## Out of Scope

- Remote push, PR publication, image publication, release workflow dispatch, deployment, and production data access or mutation.
- Changing the supported CPU architecture matrix, raising Docker's Node major, modifying the engine contract, or upgrading dependencies.
- Desktop installer packaging/signing, macOS and Windows distribution artifacts, and full multi-architecture image publication.
- Broad source-code repairs uncovered by full validation. Diagnose and report those separately before expanding this task.

## Planning Status

This is a bounded validation task with no product-code edits. Its execution plan is `docs/plans/node-runtime-release-validation.md`; curated implement/check manifests carry the existing repository and schema-regression contracts. Runtime verification and final independent evidence review are complete.

## Validation Outcome

Node 25 passed the focused 36-test regression, core suite (3156 passed, 13 skipped), complete type checking, application build, and drift check. The original Node 22 Docker build failed during dependency installation; native rebuild and startup remain unverified. A same-Node npm 11.6.2 diagnostic installed the unchanged manifests successfully, identifying a configuration follow-up without changing the original build result.

The validation task is complete with independent evidence quality **PASS**, while release readiness remains **BLOCKED**. Pinning the Docker builder's npm and rerunning the actual image build/startup is proposed separately; it is outside this validation-only task. See `verification.md` for evidence, environment corrections, cleanup, and remaining limits.
