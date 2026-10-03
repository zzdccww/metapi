# Runtime validation review

Evidence quality: **PASS**. Release readiness: **BLOCKED**.

The approved validation task has an evidence-backed outcome for every acceptance criterion. Its completion does not imply a passing Node 22 release build or startup. Final `prd.md`, `verification.md`, runtime summaries, and schema-introspection guidance are consistent with that distinction.

## Findings (fixed)

None. No product or runtime evidence was changed during this review.

## Findings (not fixed)

- No actionable Node 25 findings.
- The unchanged Node 22 Docker build fails at `docker/Dockerfile:14`: npm 10.9.9 reports `EUSAGE` and `Missing: vite@5.4.21 from lock file`. This is a release-build blocker outside the validation-only repair scope. The project `EBADENGINE` message is a separate warning. Reconcile package-manager/lockfile compatibility in a follow-up, then repeat image construction and startup smoke.
- No application image was produced, so Node 22 native rebuild, application build, migration/startup, and health checks remain unverified. A diagnostic using a different npm version cannot establish that the unchanged Dockerfile passes.

No additional review defects were found. The build blocker is accurately documented and remains outside this validation-only task's change scope.

## Verification

- Independently matched all 1,238 manifest entries to `git ls-tree` for `e69a7a44d786412ee7875bd4285bd893438eb38c`, verified the canonical archive SHA-256, and confirmed that `53d923d` is an ancestor. The canonical archive and original installation have identical parsed `package.json` and `package-lock.json`.
- Reviewed the Linux verifier and its before/after evidence: every tracked blob matched, Node `25.0.0`, npm `11.6.2`, native ABI `141`. The isolated install loaded `better-sqlite3` through an actual in-memory SQLite query and loaded Sharp.
- Lint: not applicable; the project defines no lint script.
- TypeCheck: passed, including web, web tests, server, and desktop; canonical metadata records exit 0.
- Tests: focused 36 passed; core 3,156 passed and 13 skipped across 499 passed/3 skipped files; canonical metadata records exit 0. Verified skip conditions in source: 8 live-schema cases and 5 DOM-support-conditional cases.
- Build: web, server, and desktop passed. The bundle-size advisory is not a build failure. Drift check passed with 0 violations and 3 existing tracked-debt entries.
- Initial failures remain preserved and are distinguished from canonical evidence. The pre-fix export reproduces the newline assertion and SQLite timeout; canonical LF exports and `TMPDIR=/dev/shm` pass without changing source, test selection, or timeout limits. The exact pre-fix migration/workflow comparison passes 19 tests.
- Reviewed the schema-introspection runtime guidance against the actual CI, Dockerfile, live-test gates, and archive/temporary-storage evidence. The guidance is consistent.
- Verified task-specific Node 25 cleanup logs report exit 0 for both containers and the derived image. The official base image remains cached.
- Independently read and hashed all 1,237 Node 22 exported files against the source commit's Git blobs: no differences. The only excluded tracked file is `data/.gitkeep`; `.env`, `data`, and `node_modules` are absent. Independently confirmed `package.json`, `package-lock.json`, and `docker/Dockerfile` are unchanged since before `53d923d`.
- Audited the Node 22 build helper, engine/image inventory, fatal log excerpt, and dependency diagnosis. Actual Linux amd64 runtime is Node `22.23.3`/npm `10.9.9`; failure occurs before product source is copied into the builder. The evidence supports an existing build-input/toolchain failure, without proving the npm resolver's internals.
- The engine is available, so the engine-unavailable portable fallback does not apply. The summary accurately retains the unverified container-runtime and multi-architecture gaps.
- Audited the completed npm 11 diagnostic script, raw log, result, and analysis. It used the same Node 22 base image, retained Node `22.23.3`, installed npm `11.6.2`, and ran the original `npm ci --ignore-scripts --no-audit --no-fund` command with exit 0 and 878 installed packages. Parsed raw-log phase records match the analysis; both manifest Git blob hashes match the source before and after. No bypass flags, lockfile regeneration, native rebuild, or application build are part of this result.
- The diagnostic result records no mounts, no OOM, and exit 0. Its historical cleanup evidence is supported by helper code that throws on nonzero `docker rm` or `docker container ls` exits; the successful list check recorded no matching container at `2026-10-03T05:09:30.248Z`. The executor also reported its orchestration command completed successfully. Independent review-time `docker inspect` calls later returned Docker API Internal Server Error, so current absence could not be independently reconfirmed. That API error is not treated as proof of absence; no raw `No such container` response or standalone removal log is claimed.
- Reviewed the final PRD acceptance status: AC3 explicitly records the failed real build and unreached startup, rather than asserting success. The final report/spec consistently limit npm 11 evidence to dependency installation and retain original Docker build failure, architecture/runtime gaps, and unverified production recovery. Pinning npm in the builder is a proposed follow-up, not an implemented change.

The review reused completed commands and audited their scripts, metadata, and bounded log excerpts; it did not rerun tests, builds, or type checking. The only review write is this report. No production, multi-architecture, or Node 22 application success is inferred from the Node 25 result or npm 11 diagnostic. The parent session owns replacing the final report's pending-review sentence after receiving this completed review.
