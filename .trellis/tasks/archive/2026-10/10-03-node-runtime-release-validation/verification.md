# Runtime validation evidence

## Release decision

**Release build blocked.** The declared Node 25 development/CI path passes its local checks, but the unchanged Node 22 Dockerfile fails during dependency installation. No application image or successful startup smoke test exists. This is a build-input/toolchain issue that predates the schema repair; production recovery remains unverified.

The same-Node-22 npm 11 diagnostic passed without modifying either manifest. It identifies a narrow follow-up candidate, but does not change the failed outcome of the original Dockerfile. Final independent review concluded **evidence quality PASS; release readiness BLOCKED**. See `review.md` for the audit and the limit on repeating the container cleanup check.

## Source and runtime matrix

Source revision: `e69a7a44d786412ee7875bd4285bd893438eb38c`, containing repair `53d923d`. The comparison revision before that repair is `2b4b8968f1e01d5d37249775744c132b89e70648`.

| Path | Actual runtime | Result |
| --- | --- | --- |
| Declared development/CI path | Node 25.0.0, npm 11.6.2, Linux x86_64, ABI 141 | Passed |
| Existing Dockerfile | Node 22.23.3, npm 10.9.9, Linux amd64 | Failed at `npm ci` |
| Same-Node dependency-install diagnostic | Node 22.23.3, npm 11.6.2, identical manifests | Install passed; not a Docker build |
| Existing Dockerfile application image/startup | Not reached | Unverified |

Docker deliberately retains Node 22 for ARMv7 support. This task has not changed that policy. Checks used local Docker Desktop's explicit `desktop-linux` context (Engine 26.1.1, 4 CPUs, approximately 5.75 GiB memory); the user's default context and installed Node 24 runtime were preserved.

## Node 25 final evidence

All final checks used source verified against Git blobs, with no product/test changes or increased timeouts.

| Check | Result |
| --- | --- |
| Isolated `npm ci` | Passed; 878 packages |
| Native dependency load | Passed; SQLite 3.53.4 opened in memory; sharp 0.35.4 loaded |
| Focused schema/runtime regression | Passed; 5 files, 36 tests |
| Core `npm test -- --maxWorkers=2` | Passed; 499 files passed, 3 skipped; 3156 tests passed, 13 skipped |
| `npm run typecheck` | Passed; web, web tests, server, desktop |
| `npm run build` | Passed; web, server, desktop |
| `npm run repo:drift-check` | Passed; 0 violations, 3 existing tracked-debt entries |
| Exact pre-fix migration + Docker workflow suites | Passed; 19 tests |
| Source integrity after tests/build | Passed; all 1238 Git blobs unchanged |

The 13 skips comprise 8 external/live-schema tests and 5 DOM-support-conditional cases. Core/focused commands explicitly cleared external database URLs and set `DB_PARITY_SKIP_LIVE_SCHEMA=true`. Final tests used `TMPDIR=/dev/shm` in a task-owned container with 512 MiB shared memory and two workers.

Official image: `node:25.0.0-bookworm`, ID `sha256:17b29c7d66aeaf5dcb687e121d6bbaebb3a19c40d655dc7ddfc5c26923f661c8`.

Canonical lockfile SHA256: `33b21d91149e351a1c9f142669d036d5c6bc71744c24f1be6586e5b39a82a5e8`. The installed dependency JSON matched this file; the initial export differed only in line endings.

Detailed evidence: `.codex/runtime-validation/node25/summary.md` and `logs/canonical-*.log`, with per-command arguments, exit status, and timings in adjacent JSON files.

## Node 22 build blocker

The unchanged `docker/Dockerfile:14` failed on:

```text
npm ci --ignore-scripts --no-audit --no-fund
npm error code EUSAGE
npm error Missing: vite@5.4.21 from lock file
```

The build ran from 2026-10-03T04:54:58Z to 04:58:23Z. The Node-engine mismatch message was a separate nonfatal warning. Native module rebuild, web/server compilation, migration, app startup, and `/api/desktop/health` were never reached.

`package.json`, `package-lock.json`, and `docker/Dockerfile` are byte-identical to the pre-fix revision. The manifest overrides Vite versions below 6.4.3 to 6.4.3; the lock records Vite 6.4.3, while vitepress 1.6.4 declares Vite ^5.4.14. npm 10.9.9 requested missing Vite 5.4.21 despite that override.

A disposable container using the same Node 22.23.3 base and exact manifests installed npm 11.6.2 and reran the identical `npm ci --ignore-scripts --no-audit --no-fund` command. It exited 0 and installed 878 packages; both manifest blob hashes remained unchanged. No `--force`, legacy-peer bypass, lock regeneration, or source change was used. This isolates a package-manager compatibility factor; it does not identify the exact upstream resolver implementation or prove native rebuild/application startup. Evidence: `npm11-diagnostic.log`, `npm11-diagnostic-result.json`, and `npm11-diagnostic-analysis.json` under the Node 22 artifact directory.

Node 22 base ID: `sha256:88f8ba583a884279252779bbe221bf1ff2c61cf236cc973f8ca97676ae6d07f0`; repository digest `node@sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c`.

Detailed evidence: `.codex/runtime-validation/node22/summary.md`, `docker-build.log:571`, `source-fidelity.json`, and `dependency-diagnosis.json`. The intended application image `metapi:node22-validation-e69a7a4` was not created.

## Corrected validation-environment failures

The first Node 25 run reported 6 failures; these are retained as diagnostic evidence, not unresolved product defects:

- Windows `git archive` applied `core.autocrlf`: a tracked LF YAML file became CRLF and triggered a text assertion. Native Windows tar also mis-extracted a Unicode filename. Per-command conversion disabling plus Linux tar/Unicode-safe ZIP extraction corrected the export. Final snapshots matched all Git blobs: 1238 for Node 25, 1237 for Node 22 with only `data/.gitkeep` intentionally omitted.
- SQLite migrations exceeded the default test timeout on Docker overlay-backed temporary storage. A pre-fix reproduction showed the same delay. Current and pre-fix migration suites each passed 11 tests on shared-memory temp storage; the exact pre-fix migration/workflow set then passed 19/19, and the final current core suite passed.

No source, YAML, test expectation, or global Git setting was changed to obtain these passes.

## Isolation, cleanup, and remaining work

- Node 25 task containers and the disposable derived image were removed; official base-image cache remains.
- The original Node 22 build created no app container, network, database, or application image. Its public base image and normal build cache remain.
- The npm 11 diagnostic container had no host mounts or volumes. The execution record reports successful removal, followed at 05:09:30Z by a successful container-list query with no matching name. The helper rejects nonzero Docker command exits before writing success metadata. The final reviewer could not independently repeat the check because Docker API calls returned Internal Server Error; those errors are not evidence of absence.
- Source exports, helpers, metadata, and logs remain below `.codex/runtime-validation/node25/` and `node22/`.
- No tracked product source, Node pin, lockfile, Dockerfile, CI, or deployment configuration was changed. Only documentation/task records are updated.
- No remote push, PR publication, image publication, release dispatch, production database access, or deployment occurred.
- Next work must resolve the Docker dependency-install compatibility blocker and rerun the real image build and startup smoke. Live PostgreSQL/MySQL, ARM64/ARMv7, desktop packaging/signing, publication, and production recovery remain outside this completed evidence set.

## Proposed follow-up

The smallest evidence-backed candidate is to install pinned npm 11.6.2 in the Docker builder stage before `npm ci`, keeping Node 22 and the existing architecture matrix. Then rebuild the actual Dockerfile, verify the native rebuild and web/server outputs, and run the isolated startup/health smoke. This configuration change is not implemented by the current validation-only task; the install-only diagnostic must not be represented as a successful application image.
