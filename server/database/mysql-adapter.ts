/**
 * =============================================================================
 * MYSQL DATABASE ADAPTER (STUB)
 * =============================================================================
 * 
 * MySQL/MariaDB adapter. Requires 'mysql2' package to be installed.
 * To enable: npm install mysql2
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

export class MySQLAdapter implements IDatabaseAdapter {
  private config: ConnectionConfig;

  constructor(config: ConnectionConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    throw new Error('MySQL adapter requires mysql2 package. Install with: npm install mysql2');
  }

  async disconnect(): Promise<void> {
    throw new Error('MySQL adapter not available');
  }

  async isConnected(): Promise<boolean> {
    return false;
  }

  async query(sql: string, params?: any[]): Promise<QueryResult> {
    throw new Error('MySQL adapter not available');
  }

  async getTables(): Promise<string[]> {
    throw new Error('MySQL adapter not available');
  }

  async getTableSchema(tableName: string): Promise<TableSchema> {
    throw new Error('MySQL adapter not available');
  }

  async getRowCount(tableName: string): Promise<number> {
    throw new Error('MySQL adapter not available');
  }

  async select(tableName: string, options?: any): Promise<QueryResult> {
    throw new Error('MySQL adapter not available');
  }

  async insert(tableName: string, rows: any[]): Promise<number> {
    throw new Error('MySQL adapter not available');
  }

  async update(tableName: string, data: Record<string, any>, where?: Record<string, any>): Promise<number> {
    throw new Error('MySQL adapter not available');
  }

  async delete(tableName: string, where?: Record<string, any>): Promise<number> {
    throw new Error('MySQL adapter not available');
  }

  async export(outputPath: string, options?: ExportOptions): Promise<void> {
    throw new Error('MySQL adapter not available');
  }

  async import(inputPath: string, options?: ImportOptions): Promise<void> {
    throw new Error('MySQL adapter not available');
  }

  getType(): DatabaseType {
    return 'mysql';
  }

  async beginTransaction(): Promise<void> {
    throw new Error('MySQL adapter not available');
  }

  async commit(): Promise<void> {
    throw new Error('MySQL adapter not available');
  }

  async rollback(): Promise<void> {
    throw new Error('MySQL adapter not available');
  }
}

/**
 * NOTE: To fully implement MySQL support, install mysql2 and update this file with:
 * 
 * import mysql from 'mysql2/promise';
 * 
 * Then implement the methods similar to PostgreSQLAdapter but using MySQL-specific syntax:
 * - SHOW TABLES instead of pg_tables
 * - INFORMATION_SCHEMA.COLUMNS with MySQL column types
 * - MySQL-specific SQL syntax (LIMIT without OFFSET syntax, etc.)
 * - Handle MySQL-specific data types (TINYINT, MEDIUMINT, etc.)
 */
