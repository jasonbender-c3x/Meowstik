/**
 * =============================================================================
 * DATABASE ADAPTER INTERFACE
 * =============================================================================
 * 
 * Generic database abstraction layer that enables the LLM to interact with
 * multiple database types through a unified interface.
 * 
 * Supported Databases:
 * - PostgreSQL
 * - MySQL/MariaDB
 * - SQLite
 * 
 * Supported File Formats:
 * - CSV
 * - JSON
 * - XML
 * - SQL
 * =============================================================================
 */

export type DatabaseType = 'postgresql' | 'mysql' | 'sqlite' | 'csv' | 'json' | 'xml';

export interface ConnectionConfig {
  type: DatabaseType;
  connectionString?: string;
  filePath?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
}

export interface TableSchema {
  name: string;
  columns: ColumnSchema[];
  primaryKey?: string[];
  foreignKeys?: ForeignKeySchema[];
  indexes?: IndexSchema[];
}

export interface ColumnSchema {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue?: any;
  isPrimaryKey?: boolean;
  isAutoIncrement?: boolean;
}

export interface ForeignKeySchema {
  column: string;
  referencedTable: string;
  referencedColumn: string;
}

export interface IndexSchema {
  name: string;
  columns: string[];
  unique: boolean;
}

export interface QueryResult {
  rows: any[];
  rowCount: number;
  fields?: FieldInfo[];
}

export interface FieldInfo {
  name: string;
  type: string;
}

export interface ExportOptions {
  format?: 'sql' | 'csv' | 'json' | 'xml';
  tables?: string[];
  includeSchema?: boolean;
  includeData?: boolean;
  compress?: boolean;
  pretty?: boolean;
}

export interface ImportOptions {
  format?: 'sql' | 'csv' | 'json' | 'xml';
  table?: string;
  skipErrors?: boolean;
  truncateFirst?: boolean;
  batchSize?: number;
}

/**
 * Generic database adapter interface
 */
export interface IDatabaseAdapter {
  /**
   * Connect to the database
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the database
   */
  disconnect(): Promise<void>;

  /**
   * Test if connection is active
   */
  isConnected(): Promise<boolean>;

  /**
   * Execute a raw query
   */
  query(sql: string, params?: any[]): Promise<QueryResult>;

  /**
   * Get list of all tables
   */
  getTables(): Promise<string[]>;

  /**
   * Get schema for a specific table
   */
  getTableSchema(tableName: string): Promise<TableSchema>;

  /**
   * Get row count for a table
   */
  getRowCount(tableName: string): Promise<number>;

  /**
   * Select rows from a table
   */
  select(tableName: string, options?: {
    columns?: string[];
    where?: Record<string, any>;
    limit?: number;
    offset?: number;
    orderBy?: string;
  }): Promise<QueryResult>;

  /**
   * Insert rows into a table
   */
  insert(tableName: string, rows: any[]): Promise<number>;

  /**
   * Update rows in a table
   */
  update(tableName: string, data: Record<string, any>, where?: Record<string, any>): Promise<number>;

  /**
   * Delete rows from a table
   */
  delete(tableName: string, where?: Record<string, any>): Promise<number>;

  /**
   * Export database to various formats
   */
  export(outputPath: string, options?: ExportOptions): Promise<void>;

  /**
   * Import data from various formats
   */
  import(inputPath: string, options?: ImportOptions): Promise<void>;

  /**
   * Get database type
   */
  getType(): DatabaseType;

  /**
   * Begin transaction
   */
  beginTransaction(): Promise<void>;

  /**
   * Commit transaction
   */
  commit(): Promise<void>;

  /**
   * Rollback transaction
   */
  rollback(): Promise<void>;
}

/**
 * Factory to create appropriate database adapter based on connection config
 */
export async function createDatabaseAdapter(config: ConnectionConfig): Promise<IDatabaseAdapter> {
  const { type } = config;

  switch (type) {
    case 'postgresql':
      const { PostgreSQLAdapter } = await import('./postgresql-adapter');
      return new PostgreSQLAdapter(config);

    case 'mysql':
      const { MySQLAdapter } = await import('./mysql-adapter');
      return new MySQLAdapter(config);

    case 'sqlite':
      const { SQLiteAdapter } = await import('./sqlite-adapter');
      return new SQLiteAdapter(config);

    case 'csv':
      const { CSVAdapter } = await import('./csv-adapter');
      return new CSVAdapter(config);

    case 'json':
      const { JSONAdapter } = await import('./json-adapter');
      return new JSONAdapter(config);

    case 'xml':
      const { XMLAdapter } = await import('./xml-adapter');
      return new XMLAdapter(config);

    default:
      throw new Error(`Unsupported database type: ${type}`);
  }
}

/**
 * Parse connection string to determine database type
 */
export function detectDatabaseType(connectionString: string): DatabaseType {
  if (connectionString.startsWith('postgresql://') || connectionString.startsWith('postgres://')) {
    return 'postgresql';
  }
  if (connectionString.startsWith('mysql://')) {
    return 'mysql';
  }
  if (connectionString.endsWith('.sqlite') || connectionString.endsWith('.db')) {
    return 'sqlite';
  }
  if (connectionString.endsWith('.csv')) {
    return 'csv';
  }
  if (connectionString.endsWith('.json')) {
    return 'json';
  }
  if (connectionString.endsWith('.xml')) {
    return 'xml';
  }
  
  // Default to PostgreSQL for backward compatibility
  return 'postgresql';
}

/**
 * Parse connection string into ConnectionConfig
 */
export function parseConnectionString(connectionString: string): ConnectionConfig {
  const type = detectDatabaseType(connectionString);

  if (type === 'csv' || type === 'json' || type === 'xml' || type === 'sqlite') {
    return {
      type,
      filePath: connectionString,
      connectionString
    };
  }

  // Parse SQL database connection strings
  try {
    const url = new URL(connectionString);
    return {
      type,
      host: url.hostname,
      port: url.port ? parseInt(url.port) : (type === 'mysql' ? 3306 : 5432),
      database: url.pathname.slice(1),
      username: url.username,
      password: url.password,
      ssl: url.searchParams.get('ssl') === 'true' || url.searchParams.get('sslmode') === 'require',
      connectionString
    };
  } catch (error) {
    throw new Error(`Invalid connection string: ${connectionString}`);
  }
}
