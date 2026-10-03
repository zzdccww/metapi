# Fix schema introspection startup crash

## Goal

Prevent database schema introspection from crashing application startup when the database contains relations outside its base-table inventory. Continue Codex session `01a0ffaa-aa9b-75c2-86d7-b53afcb8b477`, which resumed Claude session `cbedfe23-b9ec-42cd-992c-f2cc28c2bb38`, preserving the existing operational constraints.

## Background

- Northflank logs read during this continuation still show `TypeError: Cannot read properties of undefined (reading 'columns')` in `introspectPostgresSchema`. The latest visible failure is dated `2026-10-03T03:11:38Z`, at `dist/server/db/schemaIntrospection.js:418`.
- PostgreSQL enumerates only `BASE TABLE` entries at `src/server/db/schemaIntrospection.ts:549`, but reads columns for all visible relations at line 570 and dereferences an unchecked map lookup at line 583.
- MySQL has the same mismatch at lines 373, 402, and 431.
- The previous session did not identify the concrete production relation: local connectivity timed out and the crashing pod could not accept a shell. A production view remains a hypothesis, not a verified fact.
- The user approved creation and planning of this Trellis task on 2026-10-03.
- Existing `src/server/db/schemaIntrospection.test.ts:4` covers normalization and MySQL field casing, but not the public introspection path with mixed relation metadata.

## Requirements

- R1: PostgreSQL and MySQL introspection must tolerate column metadata whose owning relation is absent from the base-table inventory.
- R2: The resulting contract must continue to include only enumerated base tables, preserving supported column types, defaults, primary keys, indexes, and foreign keys for those tables.
- R3: Regression coverage must reproduce the missing-owner failure through the public introspection entry point without a production database connection.
- R4: Preserve cleanup of established database connections and propagation of genuine database query failures.
- R5: Record current production evidence and remaining diagnostic limits accurately. The prior authorization permits a pod shell for read-only diagnostic queries. Redeployment, remote pushes, and production database mutations require separate authorization.

## Acceptance Criteria

- [x] AC1 (R1, R3): Tests for both external dialects pass when a column belongs to a relation missing from the base-table inventory; the old implementation fails those regression cases.
- [x] AC2 (R2): Mixed metadata retains expected base-table contract content and excludes the unrelated relation. A schema with only non-base relations produces no phantom base tables.
- [x] AC3 (R2): Existing normalization, generated-schema parity, and runtime bootstrap tests remain passing.
- [x] AC4 (R4): Both database clients are closed after successful introspection and after an introspection query rejects; query errors remain visible to callers.
- [x] AC5 (R5): Verification distinguishes local proof from production recovery; no unapproved production or schema changes occur.

## Out of Scope

- Adding views or foreign tables to the managed schema contract.
- Changing Drizzle schema, migration history, generated DDL, TLS configuration, or deployment settings.
- Redeploying Northflank, publishing images, or pushing remote commits as part of this planning approval.

## Risks and Deferred Evidence

- The crash has a deterministic metadata mismatch path, but the triggering production object has not been identified.
- Live database parity tests reset their target schema and must never use production connection settings. Use isolated local databases only if available and explicitly bounded.
- The user approved the final repair plan on 2026-10-03. The existing task is active on `fix/schema-introspection-startup-crash`.

## Planning Status

- Local repair scope is bounded to introspection and focused regression coverage; no product-scope decision remains open.
- Research, the selected repair approach, and verification commands are recorded at the repository-relative path `docs/plans/schema-introspection-startup-crash.md`.
- Implementation, local checks, and independent review are complete. See `verification.md` for evidence and environment limits.
