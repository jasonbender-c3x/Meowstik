/**
 * =============================================================================
 * SQLITE DATABASE ADAPTER (STUB)
 * =============================================================================
 * 
 * SQLite adapter for file-based databases.  Requires 'better-sqlite3' package.
 * To enable: npm install better-sqlite3 @types/better-sqlite3
 * =============================================================================
 */

import {
  IDatabaseAdapter,
  ConnectionConfig,
  TableSchema,
  QueryResult,
  ExportOptions,
  ImportOptions,
  DatabaseType
} from './database-adapter';

export class SQLiteAdapter implements IDatabaseAdapter {
  private config: ConnectionConfig;

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    throw new Error('SQLite adapter requires better-sqlite3 package. Install with: npm install better-sqlite3');
  }

  async disconnect(): Promise<void> {
    throw new Error('SQLite adapter not available');
  }

  async isConnected(): Promise<boolean> {
    return false;
  }

  async query(sql: string, params?: any[]): Promise<QueryResult> {
    throw new Error('SQLite adapter not available');
  }

  async getTables(): Promise<string[]> {
    throw new Error('SQLite adapter not available');
  }

  async getTableSchema(tableName: string): Promise<TableSchema> {
    throw new Error('SQLite adapter not available');
  }

  async getRowCount(tableName: string): Promise<number> {
    throw new Error('SQLite adapter not available');
  }

  async select(tableName: string, options?: any): Promise<QueryResult> {
    throw new Error('SQLite adapter not available');
  }

  async insert(tableName: string, rows: any[]): Promise<number> {
    throw new Error('SQLite adapter not available');
  }

  async update(tableName: string, data: Record<string, any>, where?: Record<string, any>): Promise<number> {
    throw new Error('SQLite adapter not available');
  }

  async delete(tableName: string, where?: Record<string, any>): Promise<number> {
    throw new Error('SQLite adapter not available');
  }

  async export(outputPath: string, options?: ExportOptions): Promise<void> {
    throw new Error('SQLite adapter not available');
  }

  async import(inputPath: string, options?: ImportOptions): Promise<void> {
    throw new Error('SQLite adapter not available');
  }

  getType(): DatabaseType {
    return 'sqlite';
  }

  async beginTransaction(): Promise<void> {
    throw new Error('SQLite adapter not available');
  }

  async commit(): Promise<void> {
    throw new Error('SQLite adapter not available');
  }

  async rollback(): Promise<void> {
    throw new Error('SQLite adapter not available');
  }
}

/**
 * NOTE: To fully implement SQLite support, install better-sqlite3 and update this file with:
 * 
 * import Database from 'better-sqlite3';
 * 
 * Then implement the methods similar to PostgreSQLAdapter but using SQLite-specific syntax:
 * - SELECT name FROM sqlite_master WHERE type='table'
 * - PRAGMA table_info(table_name) for schema
 * - SQLite-specific SQL syntax (simpler than PostgreSQL)
 * - Handle SQLite-specific features (file-based, no network, etc.)
 * - Note: better-sqlite3 is synchronous, wrap in Promises for consistency
 */
