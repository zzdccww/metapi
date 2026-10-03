import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  introspectLiveSchema,
  normalizeDefaultValue,
  normalizeSqlType,
  readMySqlField,
} from './schemaIntrospection.js';

const drivers = vi.hoisted(() => ({
  mysql: { query: vi.fn(), end: vi.fn() },
  postgres: { connect: vi.fn(), query: vi.fn(), end: vi.fn() },
}));

vi.mock('mysql2/promise', () => ({
  default: { createConnection: async () => drivers.mysql },
}));

vi.mock('pg', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pg')>();
  return {
    ...actual,
    default: {
      ...actual.default,
      Client: class {
        connect = drivers.postgres.connect;
        query = drivers.postgres.query;
        end = drivers.postgres.end;
      },
    },
  };
});

describe('schema introspection normalization', () => {
  it('normalizes booleans consistently across dialects', () => {
    expect(normalizeSqlType('sqlite', 'INTEGER', 'use_system_proxy')).toBe('boolean');
    expect(normalizeSqlType('mysql', 'tinyint', 'use_system_proxy')).toBe('boolean');
    expect(normalizeSqlType('postgres', 'boolean', 'use_system_proxy')).toBe('boolean');
  });

  it('normalizes common default values', () => {
    expect(normalizeDefaultValue("DEFAULT 'active'")).toBe("'active'");
    expect(normalizeDefaultValue('DEFAULT FALSE')).toBe('false');
    expect(normalizeDefaultValue("datetime('now')")).toBe("datetime('now')");
  });

  it('reads mysql information_schema fields regardless of casing', () => {
    expect(readMySqlField({ COLUMN_TYPE: 'varchar(191)' }, 'column_type')).toBe('varchar(191)');
    expect(readMySqlField({ column_type: 'text' }, 'column_type')).toBe('text');
    expect(readMySqlField({ Table_Name: 'settings' }, 'table_name')).toBe('settings');
  });
});

type ExternalDialect = 'mysql' | 'postgres';
type MetadataRow = Record<string, unknown>;
type MetadataFixture = {
  tables: MetadataRow[];
  primaryKeys: MetadataRow[];
  columns: MetadataRow[];
  indexes: MetadataRow[];
  foreignKeys: MetadataRow[];
};

function makeMetadata(dialect: ExternalDialect): MetadataFixture {
  const column = (
    tableName: string,
    columnName: string,
    mysqlType: string,
    postgresType: string,
    defaultValue: string | null = null,
    nullable = false,
  ): MetadataRow => ({
    table_name: tableName,
    column_name: columnName,
    ...(dialect === 'mysql'
      ? { data_type: mysqlType, column_type: mysqlType }
      : { data_type: postgresType, udt_name: postgresType }),
    is_nullable: nullable ? 'YES' : 'NO',
    column_default: defaultValue,
  });

  return {
    tables: [{ table_name: 'accounts' }, { table_name: 'sites' }],
    primaryKeys: [
      { table_name: 'accounts', column_name: 'id' },
      { table_name: 'sites', column_name: 'id' },
    ],
    columns: [
      column('accounts', 'id', 'int', 'integer', dialect === 'postgres' ? "nextval('accounts_id_seq'::regclass)" : null),
      column('accounts_view', 'id', 'int', 'integer'),
      column('accounts', 'site_id', 'int', 'integer'),
      column('accounts', 'name', 'varchar(191)', 'character varying', dialect === 'mysql' ? 'active' : "'active'::character varying"),
      column('accounts', 'enabled', 'tinyint(1)', 'boolean', dialect === 'mysql' ? '0' : 'false'),
      column('accounts', 'config', 'json', 'jsonb', dialect === 'mysql' ? "'{}'" : "'{}'::jsonb"),
      column('accounts', 'created_at', 'datetime', 'timestamp without time zone', dialect === 'mysql' ? 'current_timestamp()' : 'now()'),
      column('accounts', 'weight', 'double', 'double precision', '1.5', true),
      column('sites', 'id', 'int', 'integer'),
    ],
    indexes: [
      {
        table_name: 'accounts', index_name: 'accounts_site_id_idx', column_name: 'site_id',
        ...(dialect === 'mysql' ? { non_unique: 1 } : { is_unique: false }),
      },
      {
        table_name: 'accounts', index_name: 'accounts_name_unique', column_name: 'name',
        ...(dialect === 'mysql' ? { non_unique: 0 } : { is_unique: true }),
      },
    ],
    foreignKeys: [{
      table_name: 'accounts', constraint_name: 'accounts_site_id_fk', column_name: 'site_id',
      referenced_table_name: 'sites', referenced_column_name: 'id', delete_rule: 'CASCADE',
    }],
  };
}

function mockMetadataQueries(
  dialect: ExternalDialect,
  metadata: MetadataFixture,
  fieldName: (name: string) => string,
  columnQueryError?: Error,
) {
  drivers[dialect].query.mockImplementation(async (sql: string) => {
    let rows: MetadataRow[];
    if (sql.includes('FROM information_schema.tables')) {
      rows = metadata.tables;
    } else if (sql.includes("constraint_type = 'PRIMARY KEY'")) {
      rows = metadata.primaryKeys;
    } else if (sql.includes('FROM information_schema.columns')) {
      if (columnQueryError) throw columnQueryError;
      rows = metadata.columns;
    } else if (sql.includes('FROM information_schema.statistics') || sql.includes('FROM pg_class t')) {
      rows = metadata.indexes;
    } else if (sql.includes('JOIN information_schema.referential_constraints')) {
      rows = metadata.foreignKeys;
    } else {
      throw new Error(`Unexpected introspection query: ${sql}`);
    }

    const resultRows = rows.map((row) => Object.fromEntries(
      Object.entries(row).map(([key, value]) => [fieldName(key), value]),
    ));
    return dialect === 'mysql' ? [resultRows] : { rows: resultRows };
  });
}

describe.each([
  { dialect: 'postgres', casing: 'lowercase', fieldName: (name: string) => name },
  { dialect: 'mysql', casing: 'lowercase', fieldName: (name: string) => name },
  { dialect: 'mysql', casing: 'uppercase', fieldName: (name: string) => name.toUpperCase() },
  { dialect: 'mysql', casing: 'mixed case', fieldName: (name: string) => name.replace(/(^|_)[a-z]/g, (part) => part.toUpperCase()) },
] as const)('$dialect live schema introspection ($casing metadata)', ({ dialect, fieldName }) => {
  beforeEach(() => {
    vi.resetAllMocks();
    drivers.postgres.connect.mockResolvedValue(undefined);
    drivers.postgres.end.mockResolvedValue(undefined);
    drivers.mysql.end.mockResolvedValue(undefined);
  });

  it('ignores columns outside the base-table inventory and preserves base-table metadata', async () => {
    mockMetadataQueries(dialect, makeMetadata(dialect), fieldName);

    const contract = await introspectLiveSchema({ dialect, connectionString: 'mock-only' });

    expect(contract).toEqual({
      tables: {
        accounts: {
          columns: {
            id: { logicalType: 'integer', notNull: true, defaultValue: null, primaryKey: true },
            site_id: { logicalType: 'integer', notNull: true, defaultValue: null, primaryKey: false },
            name: { logicalType: 'text', notNull: true, defaultValue: "'active'", primaryKey: false },
            enabled: { logicalType: 'boolean', notNull: true, defaultValue: 'false', primaryKey: false },
            config: { logicalType: 'json', notNull: true, defaultValue: "'{}'", primaryKey: false },
            created_at: { logicalType: 'datetime', notNull: true, defaultValue: "datetime('now')", primaryKey: false },
            weight: { logicalType: 'real', notNull: false, defaultValue: '1.5', primaryKey: false },
          },
        },
        sites: {
          columns: {
            id: { logicalType: 'integer', notNull: true, defaultValue: null, primaryKey: true },
          },
        },
      },
      indexes: [
        { name: 'accounts_name_unique', table: 'accounts', columns: ['name'], unique: true },
        { name: 'accounts_site_id_idx', table: 'accounts', columns: ['site_id'], unique: false },
      ],
      uniques: [{ name: 'accounts_name_unique', table: 'accounts', columns: ['name'] }],
      foreignKeys: [{
        table: 'accounts', columns: ['site_id'], referencedTable: 'sites', referencedColumns: ['id'], onDelete: 'CASCADE',
      }],
    });
    expect(drivers[dialect].end).toHaveBeenCalledTimes(1);
  });

  it('returns an empty contract when only unrelated relations have columns', async () => {
    const metadata = makeMetadata(dialect);
    mockMetadataQueries(dialect, {
      tables: [], primaryKeys: [], indexes: [], foreignKeys: [],
      columns: metadata.columns.filter((row) => row.table_name === 'accounts_view'),
    }, fieldName);

    await expect(introspectLiveSchema({ dialect, connectionString: 'mock-only' })).resolves.toEqual({
      tables: {}, indexes: [], uniques: [], foreignKeys: [],
    });
    expect(drivers[dialect].end).toHaveBeenCalledTimes(1);
  });

  it('closes the connection and propagates a column query failure', async () => {
    const queryError = new Error('column metadata query failed');
    mockMetadataQueries(dialect, makeMetadata(dialect), fieldName, queryError);

    await expect(introspectLiveSchema({ dialect, connectionString: 'mock-only' })).rejects.toBe(queryError);
    expect(drivers[dialect].end).toHaveBeenCalledTimes(1);
  });
});
