# Schema Introspection

## Scope

`src/server/db/schemaIntrospection.ts` owns conversion from database metadata to the shared schema contract. Runtime startup calls it through `runtimeSchemaBootstrap.ts`. PostgreSQL and MySQL inventory only `BASE TABLE` relations, while their column queries can also return other visible relations or metadata that changed after the inventory query.

## Signature

```typescript
introspectLiveSchema(input: {
  dialect: 'sqlite' | 'mysql' | 'postgres';
  connectionString: string;
  ssl?: boolean;
}): Promise<SchemaContract>
```

## Contract

- The enumerated base-table map owns membership in `SchemaContract.tables`. Column metadata cannot create an additional table.
- Resolve each column's owner before normalizing its type/default or writing it to `columns`.
- Preserve supported columns, primary keys, defaults, indexes, unique constraints, and foreign keys of valid base tables.
- Preserve MySQL metadata field-name normalization through `readMySqlField()`.
- Keep the existing connection cleanup in `finally`. Do not suppress query failures to make startup appear successful.
- This boundary rule requires no migration or generated schema change. It does not add view management to the contract.

## Validation and Errors

| Input or event | Required behavior |
| --- | --- |
| Column owner is in the base-table map | Normalize and attach the column |
| Column owner is absent from the map | Skip the column without adding a table |
| MySQL row lacks the required name/type fields | Preserve the existing skip behavior |
| An introspection query rejects | Reject the public call and close the established connection |
| Introspection succeeds | Return the contract and close the connection |

## Cases

- Good: valid base tables mixed with a view's columns retain their normal contract content.
- Base: an empty inventory with only unrelated column rows yields no phantom tables.
- Bad: an actual database query error remains an error, rather than returning an empty successful contract.

## Required Tests

Use mocked PostgreSQL/MySQL drivers through `introspectLiveSchema()` in `src/server/db/schemaIntrospection.test.ts`. Assert mixed metadata, empty inventory, retained normalized fields and constraints, MySQL casing, and cleanup on both success and query rejection. The missing-owner cases must fail against the old unchecked access.

Run schema unit tests, `runtimeSchemaBootstrap.test.ts`, server type checking, and the repository drift check. Live parity/upgrade/runtime tests reset their target schemas; use only isolated test databases for those suites.

## Wrong and Correct

```typescript
// Wrong: column-query scope is wider than the captured table inventory.
tableMap.get(row.table_name)!.columns[row.column_name] = column;

// Correct: the captured inventory remains authoritative.
const table = tableMap.get(row.table_name);
if (!table) continue;
// Normalize the column only after resolving its owner.
table.columns[row.column_name] = column;
```

Filtering the column SQL alone does not guarantee membership in an earlier inventory snapshot. Keep the local ownership check even if the queries are later tightened.

## Runtime Validation

The repository currently uses Node 25 for development/CI (`.nvmrc`, `package.json`, and `.github/workflows/ci.yml`) and Node 22 in both stages of `docker/Dockerfile`. The Dockerfile documents an intentional ARMv7 compatibility constraint; do not raise its Node major merely to match development. The release workflow still includes `linux/arm/v7`.

- Record the exact source revision, runtime, platform, and check outcomes. Passing on the developer machine alone does not establish either CI-runtime or Linux-container compatibility.
- Install native dependencies separately for each Node runtime. In particular, a `better-sqlite3` binary built under a different Node ABI is not valid validation evidence.
- Core CI sets `DB_PARITY_SKIP_LIVE_SCHEMA=true`, but the external-dialect live suites still run when `DB_PARITY_MYSQL_URL` or `DB_PARITY_POSTGRES_URL` is set. Explicitly unset those URLs unless using known isolated test databases.
- Build and smoke-test release candidates with fresh task-local data. Distinguish local startup success from production recovery and Linux amd64 checks from full multi-architecture validation.
- On Windows, `git archive` can apply `core.autocrlf` and change exported bytes. For a Linux validation snapshot, use per-command `git -c core.autocrlf=false -c core.eol=lf archive <revision>` and compare exported paths and raw bytes with their Git blobs. Use Linux tar or a Unicode-safe ZIP extractor; Windows tar can mis-extract Unicode filenames. Do not change global Git settings or attribute an export-induced text assertion to product code.
- If SQLite fixture migrations time out on Docker Desktop, compare the pre-fix revision and a fast temporary filesystem before classifying a regression. Record the chosen `TMPDIR` and preserve the initial failure log rather than silently increasing timeouts.
- Record npm as well as Node when validating release builds. With the current Vite overrides/lockfile, Node 22.23.3's npm 10.9.9 failed lock validation while npm 11.6.2 on the same Node and exact manifests installed successfully. A package-manager-only diagnostic does not establish native rebuild, image creation, or application startup success.
