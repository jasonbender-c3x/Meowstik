/**
 * =============================================================================
 * POSTGRESQL DATABASE ADAPTER
 * =============================================================================
 * 
 * PostgreSQL-specific implementation of the database adapter interface.
 * =============================================================================
 */

import { Pool, PoolClient } from 'pg';
import { createWriteStream, readFileSync } from 'fs';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import {
  IDatabaseAdapter,
  ConnectionConfig,
  TableSchema,
  ColumnSchema,
  QueryResult,
  ExportOptions,
  ImportOptions,
  DatabaseType
} from './database-adapter';

export class PostgreSQLAdapter implements IDatabaseAdapter {
  private pool: Pool | null = null;
  private client: PoolClient | null = null;
  private config: ConnectionConfig;
  private inTransaction = false;

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.pool) {
      return;
    }

    this.pool = new Pool({
      connectionString: this.config.connectionString,
      ssl: this.config.ssl ? { rejectUnauthorized: false } : undefined
    });

    // Test connection
    const client = await this.pool.connect();
    client.release();
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      this.client.release();
      this.client = null;
    }
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async isConnected(): Promise<boolean> {
    if (!this.pool) {
      return false;
    }
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      return true;
    } catch {
      return false;
    }
  }

  async query(sql: string, params?: any[]): Promise<QueryResult> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }

    const client = this.client || this.pool;
    const result = await client.query(sql, params);

    return {
      rows: result.rows,
      rowCount: result.rowCount || 0,
      fields: result.fields?.map(f => ({
        name: f.name,
        type: this.mapPostgreSQLType(f.dataTypeID)
      }))
    };
  }

  async getTables(): Promise<string[]> {
    const result = await this.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    return result.rows.map(row => row.tablename);
  }

  async getTableSchema(tableName: string): Promise<TableSchema> {
    // Get columns
    const columnsResult = await this.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default,
        character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [tableName]);

    const columns: ColumnSchema[] = columnsResult.rows.map(row => ({
      name: row.column_name,
      type: row.data_type,
      nullable: row.is_nullable === 'YES',
      defaultValue: row.column_default
    }));

    // Get primary key
    const pkResult = await this.query(`
      SELECT a.attname
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = $1::regclass AND i.indisprimary
    `, [tableName]);

    const primaryKey = pkResult.rows.map(row => row.attname);

    return {
      name: tableName,
      columns,
      primaryKey: primaryKey.length > 0 ? primaryKey : undefined
    };
  }

  async getRowCount(tableName: string): Promise<number> {
    const result = await this.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
    return parseInt(result.rows[0].count);
  }

  async select(tableName: string, options?: {
    columns?: string[];
    where?: Record<string, any>;
    limit?: number;
    offset?: number;
    orderBy?: string;
  }): Promise<QueryResult> {
    const columns = options?.columns?.join(', ') || '*';
    let sql = `SELECT ${columns} FROM "${tableName}"`;
    const params: any[] = [];

    if (options?.where) {
      const whereClauses: string[] = [];
      Object.entries(options.where).forEach(([key, value], index) => {
        whereClauses.push(`"${key}" = $${index + 1}`);
        params.push(value);
      });
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    if (options?.orderBy) {
      sql += ` ORDER BY ${options.orderBy}`;
    }

    if (options?.limit) {
      sql += ` LIMIT ${options.limit}`;
    }

    if (options?.offset) {
      sql += ` OFFSET ${options.offset}`;
    }

    return this.query(sql, params);
  }

  async insert(tableName: string, rows: any[]): Promise<number> {
    if (rows.length === 0) {
      return 0;
    }

    const columns = Object.keys(rows[0]);
    const values = rows.map((row, rowIndex) => {
      const rowValues = columns.map((_, colIndex) => {
        return `$${rowIndex * columns.length + colIndex + 1}`;
      });
      return `(${rowValues.join(', ')})`;
    }).join(', ');

    const params = rows.flatMap(row => columns.map(col => row[col]));

    const sql = `
      INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')})
      VALUES ${values}
      ON CONFLICT DO NOTHING
    `;

    const result = await this.query(sql, params);
    return result.rowCount;
  }

  async update(tableName: string, data: Record<string, any>, where?: Record<string, any>): Promise<number> {
    const setClauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    Object.entries(data).forEach(([key, value]) => {
      setClauses.push(`"${key}" = $${paramIndex++}`);
      params.push(value);
    });

    let sql = `UPDATE "${tableName}" SET ${setClauses.join(', ')}`;

    if (where) {
      const whereClauses: string[] = [];
      Object.entries(where).forEach(([key, value]) => {
        whereClauses.push(`"${key}" = $${paramIndex++}`);
        params.push(value);
      });
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    const result = await this.query(sql, params);
    return result.rowCount;
  }

  async delete(tableName: string, where?: Record<string, any>): Promise<number> {
    let sql = `DELETE FROM "${tableName}"`;
    const params: any[] = [];

    if (where) {
      const whereClauses: string[] = [];
      Object.entries(where).forEach(([key, value], index) => {
        whereClauses.push(`"${key}" = $${index + 1}`);
        params.push(value);
      });
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }

    const result = await this.query(sql, params);
    return result.rowCount;
  }

  async export(outputPath: string, options?: ExportOptions): Promise<void> {
    const format = options?.format || 'sql';
    
    if (format !== 'sql') {
      throw new Error(`PostgreSQL adapter does not support ${format} export directly. Use format converters.`);
    }

    const tables = options?.tables || await this.getTables();
    const includeSchema = options?.includeSchema !== false;
    const includeData = options?.includeData !== false;
    const compress = options?.compress || false;

    let sql = '';

    // Export schema
    if (includeSchema) {
      for (const tableName of tables) {
        const schema = await this.getTableSchema(tableName);
        sql += this.generateCreateTableSQL(schema) + '\n\n';
      }
    }

    // Export data
    if (includeData) {
      for (const tableName of tables) {
        const result = await this.select(tableName);
        if (result.rows.length > 0) {
          sql += this.generateInsertSQL(tableName, result.rows) + '\n\n';
        }
      }
    }

    // Write to file
    if (compress) {
      const readable = Readable.from([sql]);
      const gzip = createGzip();
      const writable = createWriteStream(outputPath);
      await pipeline(readable, gzip, writable);
    } else {
      const { writeFileSync } = await import('fs');
      writeFileSync(outputPath, sql, 'utf-8');
    }
  }

  async import(inputPath: string, options?: ImportOptions): Promise<void> {
    const format = options?.format || 'sql';

    if (format !== 'sql') {
      throw new Error(`PostgreSQL adapter does not support ${format} import directly. Use format converters.`);
    }

    const sql = readFileSync(inputPath, 'utf-8');
    
    if (options?.truncateFirst && options?.table) {
      await this.query(`TRUNCATE TABLE "${options.table}" CASCADE`);
    }

    // Execute SQL
    await this.query(sql);
  }

  getType(): DatabaseType {
    return 'postgresql';
  }

  async beginTransaction(): Promise<void> {
    if (!this.pool) {
      throw new Error('Database not connected');
    }
    this.client = await this.pool.connect();
    await this.client.query('BEGIN');
    this.inTransaction = true;
  }

  async commit(): Promise<void> {
    if (!this.inTransaction || !this.client) {
      throw new Error('No active transaction');
    }
    await this.client.query('COMMIT');
    this.client.release();
    this.client = null;
    this.inTransaction = false;
  }

  async rollback(): Promise<void> {
    if (!this.inTransaction || !this.client) {
      throw new Error('No active transaction');
    }
    await this.client.query('ROLLBACK');
    this.client.release();
    this.client = null;
    this.inTransaction = false;
  }

  // Helper methods

  private mapPostgreSQLType(typeId: number): string {
    // Map common PostgreSQL type OIDs to type names
    const typeMap: Record<number, string> = {
      16: 'boolean',
      20: 'bigint',
      21: 'smallint',
      23: 'integer',
      25: 'text',
      1043: 'varchar',
      1082: 'date',
      1114: 'timestamp',
      1184: 'timestamptz',
      3802: 'jsonb'
    };
    return typeMap[typeId] || 'unknown';
  }

  private generateCreateTableSQL(schema: TableSchema): string {
    const columns = schema.columns.map(col => {
      let def = `  "${col.name}" ${col.type.toUpperCase()}`;
      if (!col.nullable) def += ' NOT NULL';
      if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`;
      return def;
    }).join(',\n');

    let sql = `CREATE TABLE IF NOT EXISTS "${schema.name}" (\n${columns}`;

    if (schema.primaryKey && schema.primaryKey.length > 0) {
      sql += `,\n  PRIMARY KEY (${schema.primaryKey.map(k => `"${k}"`).join(', ')})`;
    }

    sql += '\n);';
    return sql;
  }

  private generateInsertSQL(tableName: string, rows: any[]): string {
    if (rows.length === 0) return '';

    const columns = Object.keys(rows[0]);
    const values = rows.map(row => {
      const vals = columns.map(col => {
        const val = row[col];
        if (val === null) return 'NULL';
        if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
        if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
        return val;
      });
      return `(${vals.join(', ')})`;
    }).join(',\n  ');

    return `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')})\nVALUES\n  ${values}\nON CONFLICT DO NOTHING;`;
  }
}
