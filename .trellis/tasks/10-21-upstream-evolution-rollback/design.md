# Restore the original UI without reverting security repairs

## Boundary

The gap is product delivery: the integrated Evolution UI is now served by
default and lacks interactions the user relied on. The original page/component
implementation remains in `src/web`. Restore that implementation at `/`, remove
Evolution-only source/build inputs, and preserve the repaired backend, schema,
dependency graph, and runtime contracts.

Source baseline for the original interface is first parent `67326f4`; current
source is `e284c73`. Do not blindly revert merge `5398f46`: it also includes
security upgrades and subsequently archived task paths. Apply an explicit
focused patch and commit it without rewriting history.

## Build and delivery

| Owner | Planned result |
| --- | --- |
| `vite.config.ts` | Select `src/web` at base `/`, output one clean `dist/web`, preserve dev proxy/host/port and chart chunking |
| `src/web/main.tsx` | Restore root router behavior; no `/legacy/` build dependency |
| `package.json` | Single `build:web`; remove Evolution typecheck/test/smoke scripts; keep patched dependencies and compiler adapters |
| `New metapi Evolution Webui/metapi/**` | Remove tracked incomplete UI source, public bundles, standalone package/lock and config |
| `tsconfig.evolution.json`, Evolution runner/discovery scripts | Remove now-unused dedicated build/test inputs |
| `vitest.config.ts` | Remove Evolution discovery import; retain local snapshot exclusions, React dedupe, and safe test environment |
| `frontendEntry.ts` and server registration | Serve one root SPA and owned transition redirects, preserving reserved namespaces |
| Docker workflow/security/lock tests | Verify the remaining root package/build contract; retain security-floor and pinned npm checks |
| README/compose/current UI docs/spec | Describe the restored interface and publish/deploy the matching project image |

Keep the existing static cache helper. Entry HTML remains `no-cache` and hashed
assets remain immutable. A clean root build must remove old `dist/web/legacy`
and Evolution bundles; no second output or environment switch may rebuild them.

Remove `lucide-react` if repository-wide use inspection confirms it was exclusive
to the deleted UI. Retain Playwright for fixture validation and retain
`typescript-compiler-api` because `src/web/i18n.test.ts` actually uses it. Update
both package locks if the manifest changes; preserve all existing security
overrides and synchronize npm/pnpm. Do not downgrade the patched production
versions merely to recreate the baseline lockfile.

## URL and session transition

Extend the existing frontend routing helper as the one owner of public UI entry
selection and supported aliases. The Fastify entry is only an adapter that
applies its redirect or entry decision.

Original paths such as `/sites`, `/accounts`, `/routes`, `/settings`, `/logs`,
`/checkin`, and `/settings/notify` load the original SPA. Redirect supported
`/legacy/<original-path>` URLs to the root equivalent. Map known Evolution
routes to existing pages:

| Updated path | Original destination |
| --- | --- |
| `/app`, `/app/dashboard` | `/` |
| `/app/sites`, `/app/accounts`, `/app/routes`, `/app/settings` | `/sites`, `/accounts`, `/routes`, `/settings` |
| `/app/oauth`, `/app/downstream-keys`, `/app/site-announcements`, `/app/events` | Same suffix under `/` |
| `/app/import-export`, `/app/notifications` | `/settings/import-export`, `/settings/notify` |
| `/app/proxy-logs`, `/app/checkins` | `/logs`, `/checkin` |
| `/app/models`, `/app/marketplace` | `/models` |
| `/app/about`, `/app/playground`, `/app/monitor` | `/about`, `/playground`, `/monitor` |

Use temporary same-origin redirects and preserve query strings. Market/model
bookmarks return the existing Models page; do not recreate an Evolution-only
feature to keep a removed route alive. Missing `/api`, `/v1`, `/monitor-proxy`,
`/assets`, and `/legacy/assets` responses must keep their reserved-path behavior
and never become HTML or success responses. Prevent redirects from interpreting
untrusted URL text as an external origin. Unknown UI paths retain the original
SPA's normal fallback behavior. No proxy protocol/path rewriting belongs here.

Keep `authSession.ts` support for valid stored `metapi-auth-token` sessions, as
well as the root interface keys. Session expiry and logout clear both key pairs.
Update comments/tests to describe one interface with migration compatibility
rather than two active shells. Keep `adminAuthFailure.ts`, the server marker,
and `src/web/api.ts` classification so upstream proxy auth failures cannot log
out the administrator. These fixes improve the restored UI independently.

## Backend, data, and runtime preservation

Do not change business services, proxy orchestration, schema, migration SQL, or
schema artifacts. Preserve `63eba8c` config/trusted-proxy rules, shared IP and
credential utilities, limiter identity, saved-token hydration/startup validation,
matched management-route authentication, and retired-route guard. The static
delivery edit in `index.ts` must leave initialization order and guards intact.

Keep narrow required compatibility adjustments introduced with patched
dependencies: Undici `Headers` imports, iterable image headers, New API shield
header shape, and structural proxy-debug headers. Existing Windows SQLite
fixture cleanup, CRLF-safe tests, and snapshot test exclusions stay in place.

Development checks use the existing task-local Node 25 runtime and native
SQLite binary. Docker continues to use the documented Node 22 ARMv7-compatible
base and npm 11.6.2 pin. A passing Windows build is not Linux image validation.

## Documentation and release

Remove current documentation claiming the new UI is default or that two
interfaces are shipped. Evolution-only comparison/parity reports introduced by
the merge may be removed from current published documentation; retain archived
task history and journals. Update the owning `frontend-delivery.md` contract and
its index description after implementation/check so future work cannot restore
the obsolete build by following stale instructions.

The compose image reference must describe an image carrying this repository's
restored build, rather than the upstream Evolution image. Use the known branch
artifact `ghcr.io/zzdccww/metapi:metapi-evolution` where describing this project;
update affected workflow tests/documentation together. Preserve environment,
port, volume, and security configuration.

Produce a new local rollback commit. Remote push and Northflank changes require
applicable user authorization after local verification; the earlier push/DNS
approvals concerned completed work. The deployment guide must identify the
service and build, distinguish mutable tag from image digest, require a
successful Linux build, and verify restored UI, assets, health, and encoded
management auth. Use the current integrated image manifest
`sha256:055c468596ee85f24d39f1c233ee92e7904c067038ac98bc980036a35f68e290`
as the previously published recovery reference, with its verification limits
documented. No database migration or credential rotation is needed.

## Risks and deferred verification

- Browser bookmarks and stored sessions cross UI versions; cover redirects and
  expiry with real behavior tests rather than only source-string assertions.
- Root manifest cleanup can affect locks; require frozen/install validation and
  renewed audits without relaxing any security floor.
- Existing chart bundles may remain large; changing chart implementation is not
  part of restoring this interface.
- Actual provider/account writes and live external database checks are excluded
  from fixtures. Container availability is an implementation-time probe; record
  its actual result before claiming release readiness.
