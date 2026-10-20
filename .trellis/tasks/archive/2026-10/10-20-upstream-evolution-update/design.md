# Integration Design

## Change Boundary

The behavior gap is missing upstream security fixes and the dual-interface delivery chain. Ownership remains in the upstream frontend build configuration, shared auth/session contracts, server static delivery, and package locks. Import the coherent upstream slice rather than reimplementing its interface. Preserve local schema introspection and administrator-route invariants.

## Integration and Contracts

- Merge pinned `refs/remotes/compare-yswlww/main` into `metapi-evolution` with a pending merge commit until review completes. Keep baseline `67326f4` as the rollback reference.
- The simulated merge has one conflict in `src/server/index.ts`. Use Fastify `reply.header()` for cache headers and avoid an unnecessary raw-response compatibility branch in the production plugin callback. Adapt focused upstream static tests only if their expectations encode the obsolete implementation rather than the contract.
- Retain `registerAdminRouteGuard(app)` and its matched route identity. Add upstream auth-failure markers through the existing `authMiddleware`, not a second registration path.
- New Vite root builds Evolution into `dist/web`; the legacy build goes into `dist/web/legacy`. Both use shared server APIs and admin session handling. Preserve upstream protocol/type adaptations and regression coverage together with dependency changes.
- Retain local Docker npm 11.6.2 pin and GHCR branch workflow. New lockfiles and overrides must stay consistent with npm/pnpm security contracts. Use a command-local official registry for security checks without changing user configuration.

## Runtime and Validation

Development contract is Node >=25; local default Node is 24.13.1; container contract remains Node 22 for documented ARMv7 compatibility. Prefer an existing or task-local supported development runtime for authoritative tests. Install native dependencies for the actual chosen runtime. Do not silently upgrade the Docker base image.

Schema contract and migration history are unchanged upstream. Disable live external-dialect tests unless isolated test URLs are explicitly provisioned. Use fixture-only browser smoke and fresh task-local data for any startup smoke.

## Tradeoffs and Rollback

A merge retains local history and avoids reinstalling a vulnerable upstream-only authentication implementation. Updating supported dependency patch lines is allowed if current audit data requires it; wider product changes require revisiting scope. Build errors caused by integration may be fixed within affected code and test/config ownership.

No production rollout occurs in this task. Before a later release, publish an artifact from the verified commit and preserve the previously running image. Source rollback reference is `67326f4`; it has known dependency vulnerabilities and therefore is not a preferred long-term deployment state.
