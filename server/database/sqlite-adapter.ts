/**
 * =============================================================================
 * SQLITE DATABASE ADAPTER
 * =============================================================================
 * 
 * SQLite adapter for file-based databases using 'better-sqlite3'.
 * =============================================================================
 */

import {
  IDatabaseAdapter,
  ConnectionConfig,
  TableSchema,
  QueryResult,
  ExportOptions,
  ImportOptions,
  DatabaseType,
  ColumnSchema
} from './database-adapter';
import Database from 'better-sqlite3';

export class SQLiteAdapter implements IDatabaseAdapter {
  private config: ConnectionConfig;
  private db: Database.Database | null = null;

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.db) return;
    try {
        const dbPath = this.config.filePath || this.config.connectionString;
        if (!dbPath) throw new Error("No file path provided for SQLite database");
        
        this.db = new Database(dbPath);
        this.db.pragma('journal_mode = WAL');
    } catch (error: any) {
        throw new Error(`Failed to connect to SQLite database: ${error.message}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  async isConnected(): Promise<boolean> {
    return !!this.db && this.db.open;
  }

  async query(sql: string, params?: any[]): Promise<QueryResult> {
    if (!this.db) await this.connect();
    try {
      const stmt = this.db!.prepare(sql);
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        const rows = stmt.all(params || []);
        return {
          rows,
          rowCount: rows.length,
          fields: rows.length > 0 ? Object.keys(rows[0] as object).map(k => ({ name: k, type: typeof (rows[0] as Record<string, unknown>)[k] })) : []
        };
      } else {
        const result = stmt.run(params || []);
        return {
          rows: [],
          rowCount: result.changes
        };
      }
    } catch (error: any) {
      throw new Error(`Query failed: ${error.message}`);
    }
  }

  async getTables(): Promise<string[]> {
    if (!this.db) await this.connect();
    const rows = this.db!.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    return rows.map((row: any) => row.name);
  }

  async getTableSchema(tableName: string): Promise<TableSchema> {
    if (!this.db) await this.connect();
    const columnsInfo = this.db!.pragma(`table_info(${tableName})`) as any[];
    
    const columns: ColumnSchema[] = columnsInfo.map(col => ({
      name: col.name,
      type: col.type,
      nullable: col.notnull === 0,
      defaultValue: col.dflt_value,
      isPrimaryKey: col.pk > 0
    }));

    return {
      name: tableName,
      columns
    };
  }

  async getRowCount(tableName: string): Promise<number> {
    if (!this.db) await this.connect();
    const result = this.db!.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get() as any;
    return result.count;
  }

  async select(tableName: string, options?: any): Promise<QueryResult> {
    if (!this.db) await this.connect();
    let sql = `SELECT ${options?.columns ? options.columns.join(', ') : '*'} FROM ${tableName}`;
    const params: any[] = [];
    
    if (options?.where) {
      const conditions = Object.keys(options.where).map(key => {
        params.push(options.where[key]);
        return `${key} = ?`;
      });
      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(' AND ')}`;
      }
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
    if (!rows || rows.length === 0) return 0;
    if (!this.db) await this.connect();
    
    // Assuming all rows have same keys
    const keys = Object.keys(rows[0]);
    const placeholders = keys.map(() => '?').join(', ');
    const sql = `INSERT INTO ${tableName} (${keys.join(', ')}) VALUES (${placeholders})`;
    
    const insert = this.db!.prepare(sql);
    const transaction = this.db!.transaction((rowsToInsert) => {
      let count = 0;
      for (const row of rowsToInsert) {
        const values = keys.map(k => {
            const val = row[k];
            // SQLite array/object handling
            if (typeof val === 'object' && val !== null) return JSON.stringify(val);
            return val;
        });
        insert.run(values);
        count++;
      }
      return count;
    });
    
    return transaction(rows);
  }

  async update(tableName: string, data: Record<string, any>, where?: Record<string, any>): Promise<number> {
     if (!this.db) await this.connect();
     const sets = Object.keys(data).map(key => `${key} = ?`);
     const params = Object.values(data).map(val => (typeof val === 'object' && val !== null) ? JSON.stringify(val) : val);
     
     let sql = `UPDATE ${tableName} SET ${sets.join(', ')}`;
     
     if (where) {
       const conditions = Object.keys(where).map(key => {
         params.push(where[key]);
         return `${key} = ?`;
       });
       if (conditions.length > 0) {
         sql += ` WHERE ${conditions.join(' AND ')}`;
       }
     }
     
     const result = this.db!.prepare(sql).run(params);
     return result.changes;
  }

  async delete(tableName: string, where?: Record<string, any>): Promise<number> {
    if (!this.db) await this.connect();
    let sql = `DELETE FROM ${tableName}`;
    const params: any[] = [];
    
    if (where) {
      const conditions = Object.keys(where).map(key => {
        params.push(where[key]);
        return `${key} = ?`;
      });
      if (conditions.length > 0) {
        sql += ` WHERE ${conditions.join(' AND ')}`;
      }
    }
    
    const result = this.db!.prepare(sql).run(params);
    return result.changes;
  }

  async export(outputPath: string, options?: ExportOptions): Promise<void> {
    throw new Error('Export not implemented for SQLite yet');
  }

  async import(inputPath: string, options?: ImportOptions): Promise<void> {
    throw new Error('Import not implemented for SQLite yet');
  }

  getType(): DatabaseType {
    return 'sqlite';
  }

  async beginTransaction(): Promise<void> {
    if (!this.db) await this.connect();
    this.db!.exec('BEGIN TRANSACTION');
  }

  async commit(): Promise<void> {
    if (!this.db) await this.connect();
    this.db!.exec('COMMIT');
  }

  async rollback(): Promise<void> {
    if (!this.db) await this.connect();
    this.db!.exec('ROLLBACK');
  }
}
