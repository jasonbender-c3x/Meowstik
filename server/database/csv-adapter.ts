/**
 * =============================================================================
 * CSV FILE ADAPTER
 * =============================================================================
 * 
 * CSV file adapter for reading and writing tabular data.
 * Treats CSV files as a single-table database.
 * =============================================================================
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
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

export class CSVAdapter implements IDatabaseAdapter {
  private config: ConnectionConfig;
  private data: any[] = [];
  private headers: string[] = [];
  private connected = false;

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (!this.config.filePath) {
      throw new Error('File path is required for CSV adapter');
    }

    if (existsSync(this.config.filePath)) {
      const content = readFileSync(this.config.filePath, 'utf-8');
      this.data = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      if (this.data.length > 0) {
        this.headers = Object.keys(this.data[0]);
      }
    } else {
      this.data = [];
      this.headers = [];
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
    // Basic SQL parsing for CSV files
    // This is a simplified implementation
    throw new Error('Raw SQL queries are not supported for CSV files. Use select/insert/update/delete methods.');
  }

  async getTables(): Promise<string[]> {
    // CSV files are treated as a single table
    return ['data'];
  }

  async getTableSchema(tableName: string): Promise<TableSchema> {
    if (tableName !== 'data') {
      throw new Error('CSV files only support a single table named "data"');
    }

    const columns: ColumnSchema[] = this.headers.map(header => ({
      name: header,
      type: 'text',
      nullable: true
    }));

    return {
      name: 'data',
      columns
    };
  }

  async getRowCount(tableName: string): Promise<number> {
    if (tableName !== 'data') {
      throw new Error('CSV files only support a single table named "data"');
    }
    return this.data.length;
  }

  async select(tableName: string, options?: {
    columns?: string[];
    where?: Record<string, any>;
    limit?: number;
    offset?: number;
    orderBy?: string;
  }): Promise<QueryResult> {
    if (tableName !== 'data') {
      throw new Error('CSV files only support a single table named "data"');
    }

    let rows = [...this.data];

    // Apply where filter
    if (options?.where) {
      rows = rows.filter(row => {
        return Object.entries(options.where!).every(([key, value]) => {
          return row[key] === value || row[key]?.toString() === value?.toString();
        });
      });
    }

    // Apply orderBy
    if (options?.orderBy) {
      const [column, direction] = options.orderBy.split(' ');
      rows.sort((a, b) => {
        const aVal = a[column];
        const bVal = b[column];
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
          filtered[col] = row[col];
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
    if (tableName !== 'data') {
      throw new Error('CSV files only support a single table named "data"');
    }

    if (rows.length === 0) {
      return 0;
    }

    // Update headers if needed
    const newHeaders = Object.keys(rows[0]);
    if (this.headers.length === 0) {
      this.headers = newHeaders;
    } else {
      // Merge headers
      newHeaders.forEach(h => {
        if (!this.headers.includes(h)) {
          this.headers.push(h);
        }
      });
    }

    // Add rows
    this.data.push(...rows);
    await this.save();

    return rows.length;
  }

  async update(tableName: string, data: Record<string, any>, where?: Record<string, any>): Promise<number> {
    if (tableName !== 'data') {
      throw new Error('CSV files only support a single table named "data"');
    }

    let count = 0;
    this.data = this.data.map(row => {
      const matches = !where || Object.entries(where).every(([key, value]) => {
        return row[key] === value || row[key]?.toString() === value?.toString();
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
    if (tableName !== 'data') {
      throw new Error('CSV files only support a single table named "data"');
    }

    const initialLength = this.data.length;

    if (!where) {
      this.data = [];
    } else {
      this.data = this.data.filter(row => {
        return !Object.entries(where).every(([key, value]) => {
          return row[key] === value || row[key]?.toString() === value?.toString();
        });
      });
    }

    await this.save();
    return initialLength - this.data.length;
  }

  async export(outputPath: string, options?: ExportOptions): Promise<void> {
    const format = options?.format || 'csv';

    if (format === 'csv') {
      await this.save(outputPath);
    } else if (format === 'json') {
      writeFileSync(outputPath, JSON.stringify(this.data, null, options?.pretty ? 2 : 0), 'utf-8');
    } else {
      throw new Error(`Export format ${format} not supported for CSV adapter`);
    }
  }

  async import(inputPath: string, options?: ImportOptions): Promise<void> {
    const format = options?.format || 'csv';

    if (format === 'csv') {
      const content = readFileSync(inputPath, 'utf-8');
      const rows = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });

      if (options?.truncateFirst) {
        this.data = [];
      }

      await this.insert('data', rows);
    } else if (format === 'json') {
      const content = readFileSync(inputPath, 'utf-8');
      const rows = JSON.parse(content);

      if (!Array.isArray(rows)) {
        throw new Error('JSON import expects an array of objects');
      }

      if (options?.truncateFirst) {
        this.data = [];
      }

      await this.insert('data', rows);
    } else {
      throw new Error(`Import format ${format} not supported for CSV adapter`);
    }
  }

  getType(): DatabaseType {
    return 'csv';
  }

  async beginTransaction(): Promise<void> {
    // CSV files don't support transactions
  }

  async commit(): Promise<void> {
    // CSV files don't support transactions
    await this.save();
  }

  async rollback(): Promise<void> {
    // CSV files don't support transactions
    await this.connect(); // Reload from file
  }

  // Helper methods

  private async save(outputPath?: string): Promise<void> {
    const path = outputPath || this.config.filePath;
    if (!path) {
      throw new Error('No output path specified');
    }

    const csv = stringify(this.data, {
      header: true,
      columns: this.headers
    });

    writeFileSync(path, csv, 'utf-8');
  }
}
