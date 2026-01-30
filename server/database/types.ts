/**
 * =============================================================================
 * GENERIC DATABASE ABSTRACTION TYPES
 * =============================================================================
 * 
 * Enables LLM to interact with any database type commonly used in development:
 * - Relational: PostgreSQL, MySQL, SQLite, SQL Server, Oracle
 * - NoSQL: MongoDB, Redis, CouchDB
 * - File-based: CSV, JSON, XML, YAML
 * - Cloud: DynamoDB, Firestore, BigQuery
 * 
 * Provides a unified interface for database operations regardless of underlying
 * database technology.
 * =============================================================================
 */

export type DatabaseType = 
  // Relational databases
  | 'postgresql' 
  | 'mysql' 
  | 'sqlite' 
  | 'sqlserver'
  | 'oracle'
  | 'mariadb'
  // NoSQL databases
  | 'mongodb'
  | 'redis'
  | 'couchdb'
  | 'cassandra'
  // File-based formats
  | 'csv' 
  | 'json' 
  | 'xml'
  | 'yaml'
  | 'parquet'
  // Cloud databases
  | 'dynamodb'
  | 'firestore'
  | 'bigquery'
  | 'cosmosdb';

export interface ConnectionConfig {
  type: DatabaseType;
  url?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  filePath?: string;
  options?: Record<string, unknown>;
}

export interface TableInfo {
  name: string;
  rowCount: number;
  columns: ColumnInfo[];
  indexes?: IndexInfo[];
}

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  defaultValue?: unknown;
  autoIncrement?: boolean;
}

export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface QueryResult {
  rows: Record<string, unknown>[];
  rowCount: number;
  fields: ColumnInfo[];
}

export interface ExportOptions {
  format: 'sql' | 'csv' | 'json' | 'xml' | 'yaml';
  includeSchema?: boolean;
  includeData?: boolean;
  compress?: boolean;
  tables?: string[];
  outputPath?: string;
}

export interface ImportOptions {
  format: 'sql' | 'csv' | 'json' | 'xml' | 'yaml';
  filePath: string;
  dryRun?: boolean;
  skipErrors?: boolean;
  tableName?: string;
  createTable?: boolean;
}

/**
 * Generic database adapter interface
 * All database implementations must conform to this interface
 */
export interface IDatabaseAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  testConnection(): Promise<boolean>;
  getTables(): Promise<TableInfo[]>;
  getTableInfo(tableName: string): Promise<TableInfo>;
  query(sql: string, params?: unknown[]): Promise<QueryResult>;
  getRows(tableName: string, limit?: number, offset?: number): Promise<QueryResult>;
  insert(tableName: string, data: Record<string, unknown>): Promise<void>;
  update(tableName: string, data: Record<string, unknown>, where: Record<string, unknown>): Promise<number>;
  delete(tableName: string, where: Record<string, unknown>): Promise<number>;
  export(options: ExportOptions): Promise<string>;
  import(options: ImportOptions): Promise<void>;
  getType(): DatabaseType;
}
