# Source evidence for Issue #629

- HEAD at planning: `84297fab1bdf16919008c628fd1b7f87c441d8fb`; installed Fastify `5.12.3`.
- `src/server/index.ts:212` creates the admin limiter; `:225-231` performs the vulnerable raw-URL classification. Global limiter and retired-route guard precede it; API registration starts at `:233`.
- `src/server/desktop.ts:5-6` owns the public health and OAuth callback predicate. Use the same matched route identity for this predicate and management classification; do not copy its exception list.
- `src/server/middleware/auth.ts:203` owns real administrator IP and token checks. Existing IP helpers and proxy behavior are already tested in `auth.test.ts` / `auth.proxy.test.ts`.
- `src/server/middleware/requestRateLimit.ts` exports the shared limiter factory and reset helper. Preserve the current administrator bucket/options.
- `globalRateLimit.test.ts:199` and `:235` have test-local copies of the vulnerable guard; replace relevant copies with the registrar. `:291` source-checks the inline auth call and must follow the new production registration.
- Backup export relies on global auth (`routes/api/settings.ts:1852`); backup sections retain credential fields (`services/backupService.ts:1331,1407`). Fix all management API entry points together.
- `.codex/security-629/results.json` preserves 34 source-derived assertions, including the bypass and candidate control. The candidate used matched `routeOptions.url` with a raw URL fallback and correctly preserved public and proxy controls.
- Backend spec files are currently placeholders except schema introspection. Follow root AGENTS.md and neighboring implementation/test conventions; do not treat placeholders as evidence of additional requirements.
- Context-mode tools are not callable in this session. Use bounded local scripts and concise tool outputs; no long Docker or WSL experiments.
