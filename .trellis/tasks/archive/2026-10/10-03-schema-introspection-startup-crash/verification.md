# Verification: schema introspection startup crash

## Local result

The PostgreSQL and MySQL column loops now resolve their owner in the captured base-table map before normalization or assignment. Missing owners are skipped. The change adds no schema, migration, generated artifact, dependency, or deployment configuration changes.

## Regression evidence

- Before the production-code fix, the focused introspection suite ran 15 tests: 8 failed with the expected `TypeError` reading `columns`, and 7 passed. The failures covered mixed metadata and an empty base-table inventory for PostgreSQL and three MySQL metadata casing variants.
- After the two guards, all 15 focused tests passed. There are 12 new regression cases in addition to the 3 original normalization tests.
- Expected full contracts preserve all six supported logical types, defaults, primary keys, ordinary and unique indexes, unique constraints, and foreign keys for valid base tables.
- Driver mocks exercise `introspectLiveSchema()` without real database connections. Query-error tests verify error identity and closure of established connections; successful cases also verify closure.
- Adjacent primary-key, index, and foreign-key handling does not dereference a missing table owner. The remaining non-null map reads reconstruct tables from the same names that seeded the map.

## Checks

| Command | Result |
| --- | --- |
| `npm run test:schema:unit` | Passed: 4 files, 28 tests |
| `npx vitest run --root . src/server/db/runtimeSchemaBootstrap.test.ts` | Passed: 1 file, 8 tests |
| `npm run typecheck:server` | Passed |
| `npm run repo:drift-check` | Passed: 0 violations; 3 existing tracked debt entries unchanged |
| `git diff --check` | Passed |

Final independent Trellis review passed without findings or further changes. The reviewer reran server type checking and `git diff --check`, reviewed mock isolation and full contract assertions, and reused the successful schema/runtime/drift results above. The repository has no lint command or configuration; lint was not reported as executed.

## Limits and operations

- Validation used Node `v24.13.1`; the repository declares Node `>=25.0.0`. The tests pass locally, but validation on the declared supported runtime was not performed.
- No live database parity, upgrade, or runtime suites were executed: their reset helpers must only target isolated databases.
- The latest production failure visible in the resumed session was `2026-10-03T03:11:38Z` in `dist/server/db/schemaIntrospection.js:418`. The triggering relation remains unidentified, and production recovery has not been verified.
- No remote push, image publish, redeployment, or production data mutation was performed. Deployment requires separate authorization. Rolling back the local work commit restores the old code; no data rollback is needed for this patch.
