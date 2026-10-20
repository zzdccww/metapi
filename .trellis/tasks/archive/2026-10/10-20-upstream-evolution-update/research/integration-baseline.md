# Reviewed Integration Evidence

See the detailed read-only comparison in `docs/plans/upstream-update-comparison-2026-10-20.md`.

Pinned upstream `674db2e7ce478119e7e3546dd735befc6610ce95` and local baseline `67326f477d1d08ac47b882b922aa43c261cbaefc` have six upstream/fifteen local exclusive commits. Simulated merge reports only a cache-header conflict in server index. Simulated tree preserves local schemaIntrospection, adminRouteGuard and its test, Dockerfile, GHCR workflow, plus production guard registration.

Root current registry npmmirror.com has no audit API; use command-local official npm registry. Baseline full audit: 24 findings (1 critical, 8 high, 12 moderate, 3 low). Baseline omit-dev audit: 12 findings (4 high, 8 moderate). These are separate graph computations and must not be added together. Upstream historical zero-audit claims require current reproduction.

Default local Node 24.13.1 is below repository development engines >=25; container remains Node 22 by intentional ARMv7 policy. Avoid global tool/config changes and native ABI mismatches. Separate Evolution package uses newer React for independent use while integrated root build deduplicates React through root aliases; follow the existing upstream build path.
