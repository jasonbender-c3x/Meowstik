/**
 * =============================================================================
 * JSON FILE ADAPTER
 * =============================================================================
 * 
 * JSON file adapter for reading and writing structured data.
 * Supports both array-of-objects (table-like) and nested object structures.
 * =============================================================================
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
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

export class JSONAdapter implements IDatabaseAdapter {
  private config: ConnectionConfig;
  private data: any = {};
  private connected = false;

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (!this.config.filePath) {
      throw new Error('File path is required for JSON adapter');
    }

    if (existsSync(this.config.filePath)) {
      const content = readFileSync(this.config.filePath, 'utf-8');
      this.data = JSON.parse(content);
    } else {
      this.data = {};
    }

    this.connected = true;
  }

  async disconnect(): Promise<void> {
    this.connected = false;
  }

  async isConnected(): Promise<boolean> {
    return this.connected;
  }

  async query(sql: string, params?: any[]): Promise<QueryResult> {
    throw new Error('Raw SQL queries are not supported for JSON files. Use select/insert/update/delete methods.');
  }

  async getTables(): Promise<string[]> {
    // Each top-level array in the JSON object is treated as a table
    const tables: string[] = [];
    for (const key in this.data) {
      if (Array.isArray(this.data[key])) {
        tables.push(key);
      }
    }
    return tables;
  }

  async getTableSchema(tableName: string): Promise<TableSchema> {
    const table = this.data[tableName];
    if (!table || !Array.isArray(table)) {
      throw new Error(`Table ${tableName} not found or is not an array`);
    }

    if (table.length === 0) {
      return {
        name: tableName,
        columns: []
      };
    }

    // Infer schema from first row
    const firstRow = table[0];
    const columns: ColumnSchema[] = Object.keys(firstRow).map(key => ({
      name: key,
      type: this.inferType(firstRow[key]),
      nullable: true
    }));

    return {
      name: tableName,
      columns
    };
  }

  async getRowCount(tableName: string): Promise<number> {
    const table = this.data[tableName];
    if (!table || !Array.isArray(table)) {
      throw new Error(`Table ${tableName} not found or is not an array`);
    }
    return table.length;
  }

  async select(tableName: string, options?: {
    columns?: string[];
    where?: Record<string, any>;
    limit?: number;
    offset?: number;
    orderBy?: string;
  }): Promise<QueryResult> {
    const table = this.data[tableName];
    if (!table || !Array.isArray(table)) {
      throw new Error(`Table ${tableName} not found or is not an array`);
    }

    let rows = [...table];

    // Apply where filter
    if (options?.where) {
      rows = rows.filter(row => {
        return Object.entries(options.where!).every(([key, value]) => {
          return this.deepEqual(this.getNestedValue(row, key), value);
        });
      });
    }

    // Apply orderBy
    if (options?.orderBy) {
      const [column, direction] = options.orderBy.split(' ');
      rows.sort((a, b) => {
        const aVal = this.getNestedValue(a, column);
        const bVal = this.getNestedValue(b, column);
        const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
        return direction?.toUpperCase() === 'DESC' ? -cmp : cmp;
      });
    }

    // Apply offset and limit
    const offset = options?.offset || 0;
    const limit = options?.limit || rows.length;
    rows = rows.slice(offset, offset + limit);

    // Apply column selection
    if (options?.columns) {
      rows = rows.map(row => {
        const filtered: any = {};
        options.columns!.forEach(col => {
          filtered[col] = this.getNestedValue(row, col);
        });
        return filtered;
      });
    }

    return {
      rows,
      rowCount: rows.length
    };
  }

  async insert(tableName: string, rows: any[]): Promise<number> {
    if (!this.data[tableName]) {
      this.data[tableName] = [];
    }

    if (!Array.isArray(this.data[tableName])) {
      throw new Error(`${tableName} is not an array and cannot accept row inserts`);
    }

    this.data[tableName].push(...rows);
    await this.save();

    return rows.length;
  }

  async update(tableName: string, data: Record<string, any>, where?: Record<string, any>): Promise<number> {
    const table = this.data[tableName];
    if (!table || !Array.isArray(table)) {
      throw new Error(`Table ${tableName} not found or is not an array`);
    }

    let count = 0;
    this.data[tableName] = table.map(row => {
      const matches = !where || Object.entries(where).every(([key, value]) => {
        return this.deepEqual(this.getNestedValue(row, key), value);
      });

      if (matches) {
        count++;
        return { ...row, ...data };
      }
      return row;
    });

    await this.save();
    return count;
  }

  async delete(tableName: string, where?: Record<string, any>): Promise<number> {
    const table = this.data[tableName];
    if (!table || !Array.isArray(table)) {
      throw new Error(`Table ${tableName} not found or is not an array`);
    }

    const initialLength = table.length;

    if (!where) {
      this.data[tableName] = [];
    } else {
      this.data[tableName] = table.filter(row => {
        return !Object.entries(where).every(([key, value]) => {
          return this.deepEqual(this.getNestedValue(row, key), value);
        });
      });
    }

    await this.save();
    return initialLength - this.data[tableName].length;
  }

  async export(outputPath: string, options?: ExportOptions): Promise<void> {
    const format = options?.format || 'json';

    if (format === 'json') {
      writeFileSync(
        outputPath,
        JSON.stringify(this.data, null, options?.pretty ? 2 : 0),
        'utf-8'
      );
    } else if (format === 'csv') {
      // Export first table as CSV
      const tables = await this.getTables();
      if (tables.length === 0) {
        throw new Error('No tables to export');
      }

      const tableName = options?.tables?.[0] || tables[0];
      const result = await this.select(tableName);

      const { stringify } = await import('csv-stringify/sync');
      const csv = stringify(result.rows, { header: true });
      writeFileSync(outputPath, csv, 'utf-8');
    } else {
      throw new Error(`Export format ${format} not supported for JSON adapter`);
    }
  }

  async import(inputPath: string, options?: ImportOptions): Promise<void> {
    const format = options?.format || 'json';

    if (format === 'json') {
      const content = readFileSync(inputPath, 'utf-8');
      const imported = JSON.parse(content);

      if (options?.table) {
        // Import as a specific table
        if (Array.isArray(imported)) {
          this.data[options.table] = imported;
        } else {
          this.data[options.table] = [imported];
        }
      } else {
        // Import entire structure
        if (options?.truncateFirst) {
          this.data = imported;
        } else {
          this.data = { ...this.data, ...imported };
        }
      }

      await this.save();
    } else if (format === 'csv') {
      if (!options?.table) {
        throw new Error('Table name is required for CSV import to JSON');
      }

      const { parse } = await import('csv-parse/sync');
      const content = readFileSync(inputPath, 'utf-8');
      const rows = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      if (options.truncateFirst) {
        this.data[options.table] = rows;
      } else {
        if (!this.data[options.table]) {
          this.data[options.table] = [];
        }
        this.data[options.table].push(...rows);
      }

      await this.save();
    } else {
      throw new Error(`Import format ${format} not supported for JSON adapter`);
    }
  }

  getType(): DatabaseType {
    return 'json';
  }

  async beginTransaction(): Promise<void> {
    // JSON files don't support transactions
  }

  async commit(): Promise<void> {
    await this.save();
  }

  async rollback(): Promise<void> {
    await this.connect(); // Reload from file
  }

  // Helper methods

  private async save(outputPath?: string): Promise<void> {
    const path = outputPath || this.config.filePath;
    if (!path) {
      throw new Error('No output path specified');
    }

    writeFileSync(path, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  private inferType(value: any): string {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'number';
    if (typeof value === 'string') return 'string';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return 'unknown';
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;

    if (typeof a === 'object') {
      return JSON.stringify(a) === JSON.stringify(b);
    }

    return a.toString() === b.toString();
  }
}
