/**
 * =============================================================================
 * POSTGRESQL DATABASE ADAPTER
 * =============================================================================
 * 
 * PostgreSQL implementation of the generic database adapter interface.
 * Wraps existing PostgreSQL functionality with the unified interface.
 * =============================================================================
 */

import { Pool } from 'pg';
import {
  ConnectionConfig,
  DatabaseType,
  IDatabaseAdapter,
  TableInfo,
  ColumnInfo,
  QueryResult,
  ExportOptions,
  ImportOptions,
} from '../types';
import { writeFileSync, readFileSync } from 'fs';
import { createGzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { createWriteStream } from 'fs';

export class PostgreSQLAdapter implements IDatabaseAdapter {
  private pool: Pool | null = null;
  private config: ConnectionConfig;

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    this.pool = new Pool({
      connectionString: this.config.url,
    });
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async testConnection(): Promise<boolean> {
    if (!this.pool) await this.connect();
    try {
      await this.pool!.query('SELECT 1');
      return true;
    } catch (error) {
      return false;
    }
  }

  async getTables(): Promise<TableInfo[]> {
    if (!this.pool) await this.connect();
    
    const result = await this.pool!.query(`
      SELECT 
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    const tables: TableInfo[] = [];
    for (const row of result.rows) {
      const countResult = await this.pool!.query(`SELECT COUNT(*) FROM "${row.table_name}"`);
      tables.push({
        name: row.table_name,
        rowCount: parseInt(countResult.rows[0].count),
        columns: await this.getColumns(row.table_name),
      });
    }

    return tables;
  }

  async getTableInfo(tableName: string): Promise<TableInfo> {
    if (!this.pool) await this.connect();
    
    const countResult = await this.pool!.query(`SELECT COUNT(*) FROM "${tableName}"`);
    const columns = await this.getColumns(tableName);

    return {
      name: tableName,
      rowCount: parseInt(countResult.rows[0].count),
      columns,
    };
  }

  private async getColumns(tableName: string): Promise<ColumnInfo[]> {
    if (!this.pool) await this.connect();
    
    const result = await this.pool!.query(`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = $1 AND table_schema = 'public'
      ORDER BY ordinal_position
    `, [tableName]);

    const pkResult = await this.pool!.query(`
      SELECT a.attname
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = $1::regclass AND i.indisprimary
    `, [tableName]);

    const primaryKeys = new Set(pkResult.rows.map(r => r.attname));

    return result.rows.map(row => ({
      name: row.column_name,
      type: row.data_type,
      nullable: row.is_nullable === 'YES',
      primaryKey: primaryKeys.has(row.column_name),
      defaultValue: row.column_default,
    }));
  }

  async query(sql: string, params?: unknown[]): Promise<QueryResult> {
    if (!this.pool) await this.connect();
    
    const result = await this.pool!.query(sql, params);
    
    return {
      rows: result.rows,
      rowCount: result.rowCount || 0,
      fields: result.fields.map(f => ({
        name: f.name,
        type: f.dataTypeID.toString(),
        nullable: true,
        primaryKey: false,
      })),
    };
  }

  async getRows(tableName: string, limit = 100, offset = 0): Promise<QueryResult> {
    if (!this.pool) await this.connect();
    
    const result = await this.pool!.query(
      `SELECT * FROM "${tableName}" LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const columns = await this.getColumns(tableName);

    return {
      rows: result.rows,
      rowCount: result.rowCount || 0,
      fields: columns,
    };
  }

  async insert(tableName: string, data: Record<string, unknown>): Promise<void> {
    if (!this.pool) await this.connect();
    
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

    await this.pool!.query(
      `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${placeholders})`,
      values
    );
  }

  async update(tableName: string, data: Record<string, unknown>, where: Record<string, unknown>): Promise<number> {
    if (!this.pool) await this.connect();
    
    const setColumns = Object.keys(data);
    const setValues = Object.values(data);
    const whereColumns = Object.keys(where);
    const whereValues = Object.values(where);

    const setClause = setColumns.map((col, i) => `"${col}" = $${i + 1}`).join(', ');
    const whereClause = whereColumns.map((col, i) => `"${col}" = $${setColumns.length + i + 1}`).join(' AND ');

    const result = await this.pool!.query(
      `UPDATE "${tableName}" SET ${setClause} WHERE ${whereClause}`,
      [...setValues, ...whereValues]
    );

    return result.rowCount || 0;
  }

  async delete(tableName: string, where: Record<string, unknown>): Promise<number> {
    if (!this.pool) await this.connect();
    
    const whereColumns = Object.keys(where);
    const whereValues = Object.values(where);
    const whereClause = whereColumns.map((col, i) => `"${col}" = $${i + 1}`).join(' AND ');

    const result = await this.pool!.query(
      `DELETE FROM "${tableName}" WHERE ${whereClause}`,
      whereValues
    );

    return result.rowCount || 0;
  }

  async export(options: ExportOptions): Promise<string> {
    if (!this.pool) await this.connect();
    
    const tables = options.tables || (await this.getTables()).map(t => t.name);
    let output = '';

    // Add header
    output += `-- PostgreSQL Database Export\n`;
    output += `-- Generated: ${new Date().toISOString()}\n\n`;

    for (const tableName of tables) {
      if (options.includeSchema !== false) {
        // Export schema
        const columns = await this.getColumns(tableName);
        output += `-- Table: ${tableName}\n`;
        output += `CREATE TABLE IF NOT EXISTS "${tableName}" (\n`;
        output += columns.map(col => {
          let def = `  "${col.name}" ${col.type}`;
          if (col.primaryKey) def += ' PRIMARY KEY';
          if (!col.nullable) def += ' NOT NULL';
          if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`;
          return def;
        }).join(',\n');
        output += `\n);\n\n`;
      }

      if (options.includeData !== false) {
        // Export data
        const result = await this.pool!.query(`SELECT * FROM "${tableName}"`);
        for (const row of result.rows) {
          const columns = Object.keys(row);
          const values = Object.values(row).map(v => {
            if (v === null) return 'NULL';
            if (typeof v === 'string') return `'${v.replace(/'/g, "''")}'`;
            if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
            return String(v);
          });
          output += `INSERT INTO "${tableName}" (${columns.map(c => `"${c}"`).join(', ')}) VALUES (${values.join(', ')}) ON CONFLICT DO NOTHING;\n`;
        }
        output += '\n';
      }
    }

    const outputPath = options.outputPath || `export-${Date.now()}.sql`;
    
    if (options.compress) {
      const gzipPath = outputPath + '.gz';
      const readable = Readable.from(output);
      const writable = createWriteStream(gzipPath);
      const gzip = createGzip();
      await pipeline(readable, gzip, writable);
      return gzipPath;
    } else {
      writeFileSync(outputPath, output);
      return outputPath;
    }
  }

  async import(options: ImportOptions): Promise<void> {
    if (!this.pool) await this.connect();
    
    const content = readFileSync(options.filePath, 'utf-8');
    const statements = content.split(';').filter(s => s.trim());

    for (const statement of statements) {
      if (statement.trim()) {
        try {
          await this.pool!.query(statement);
        } catch (error) {
          if (!options.skipErrors) throw error;
          console.error(`Error executing statement: ${error}`);
        }
      }
    }
  }

  getType(): DatabaseType {
    return 'postgresql';
  }
}
