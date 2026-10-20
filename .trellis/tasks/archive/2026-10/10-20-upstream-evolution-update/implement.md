# Execution Plan

## Ordered Work

- [x] Validate context manifests and activate the reviewed task.
- [x] Preserve baseline reference and merge upstream `674db2e` without committing; resolve the static-header conflict and inspect preservation of local guards, schema filtering, Docker pin and workflow.
- [x] Use task-local Node 25 and validate its native SQLite dependency. Keep lockfiles/overrides synchronized.
- [x] Run root complete/production and standalone Evolution npm audits against registry.npmjs.org; all return zero after targeted patch updates.
- [x] Run focused regressions, full source tests, type checking, build, Evolution tests and drift check.
- [x] Run fixture browser smoke and built-server fresh SQLite startup smoke. Docker build/startup blocked by WSL initialization failure; recorded in verification.md.
- [x] Attempt Trellis dispatch; model unavailable. Complete full-scope main-session review and fix findings; record fallback in review.md and verification.md.
- [x] Record verification, update useful spec contracts and locally commit the merge and integration fixes as `5398f46`; proceed to task archival and session recording.

## Commands and Gates

Use `rtk` for shell commands. Capture verbose output to task-local verification logs and return only derived failure/success summaries. No context-mode tools are currently exposed; use bounded local scripts as fallback. Never execute live DB reset suites against user databases. Unset `DB_PARITY_MYSQL_URL` and `DB_PARITY_POSTGRES_URL`, and set `DB_PARITY_SKIP_LIVE_SCHEMA=true` in test processes.

Primary commands: `npm ci`, `npm audit --package-lock-only --registry=https://registry.npmjs.org`, its `--omit=dev` variant, `npm run typecheck`, `npm test -- --maxWorkers=2`, `npm run test:web:evolution`, `npm run build`, `npm run smoke:web:evolution`, `npm run repo:drift-check`, and real Docker build/smoke when available.

Use baseline `67326f4` for preservation comparisons and identify upstream diff separately from integration edits. Do not stage unrelated untracked files. Do not push or deploy.
