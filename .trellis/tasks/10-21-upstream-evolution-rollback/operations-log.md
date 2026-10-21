# Implementation decisions and environment limits

- User approved the latest full planning summary on 2026-10-21; task activated
  before product edits.
- Native `trellis-implement` dispatch failed with `Unknown model
  deepseek-v4-flash`. Main-session implementation/check is the fallback; no
  model override or production action was performed.
- Context-mode tools are not exposed. Use bounded local scripts and file-backed
  command logs through `rtk proxy`.
- Docker client probe failed because the Windows `docker_engine` named pipe
  does not exist. No Linux container build/startup validation has passed here.
- Delete only the 146 tracked obsolete UI/build/report files identified from
  Git and verified to stay under the repository. Use native patch deletion;
  preserve unrelated local validation directories and runtimes.
- Final check-agent dispatch failed with the same unsupported inherited model;
  main-session full-scope review applies the loaded `trellis-check` checklist.
- First full-suite run hit pre-existing slow SQLite initialization at Vitest's
  default hook timeout. It was stopped and rerun with command-local
  `--hookTimeout=120000`, matching the established test timeout. All 3368 tests
  passed (14 environment skips). A shutdown warning for `dashboardHookOrder`
  did not reproduce in a subsequent isolated one-worker run; no product or test
  timeout defaults were changed.
- Browser fixture corrections used the existing desktop checkbox selector and
  actual `/api/accounts` snapshot shape. Original site/account edits, route
  search/group/batch entry, settings write/reload, session reuse, and mobile nav
  then passed without changes to original page code.
- Three initial startup-script failures required re-evaluation: the asset regex
  wrongly required a prefix before root `/assets`, and unmatched `/api/` is
  authenticated before its 404 by the preserved raw-URL guard. Inspecting the
  actual guard established the expected unauthenticated 401 / authenticated
  404 contract. Correct fixture assertions rather than altering production auth.
- Final built-server fixture confirmed `/api/missing` is 401 without credentials
  and 404 with valid credentials; an unregistered `/v1/missing` is 404 because
  proxy hooks belong to registered proxy routes. The reviewed fixture passed all
  startup/UI/assets/redirect/auth assertions after matching these existing rules.
- npm lock comparison: no retained package changed version; only unused
  `lucide-react` was removed. pnpm regeneration added registry platform metadata
  (libc selectors) without planned dependency upgrades; frozen lock validation
  passed. Both full and production npm audits report zero findings.
