/**
 * =============================================================================
 * DATABASE ADAPTER FACTORY
 * =============================================================================
 * 
 * Auto-detects database type from connection string and creates the
 * appropriate adapter. Enables LLM to work with any database seamlessly.
 * =============================================================================
 */

import { ConnectionConfig, DatabaseType, IDatabaseAdapter } from './types';
import { PostgreSQLAdapter } from './adapters/postgresql';
import { MySQLAdapter } from './adapters/mysql';
import { SQLiteAdapter } from './adapters/sqlite';
import { CSVAdapter } from './adapters/csv';
import { JSONAdapter } from './adapters/json';
import { XMLAdapter } from './adapters/xml';

/**
 * Detect database type from connection string
 */
export function detectDatabaseType(connectionString: string): DatabaseType {
  const lower = connectionString.toLowerCase();
  
  if (lower.startsWith('postgresql://') || lower.startsWith('postgres://')) {
    return 'postgresql';
  }
  if (lower.startsWith('mysql://')) {
    return 'mysql';
  }
  if (lower.startsWith('sqlite://') || lower.endsWith('.db') || lower.endsWith('.sqlite')) {
    return 'sqlite';
  }
  if (lower.startsWith('sqlserver://') || lower.startsWith('mssql://')) {
    return 'sqlserver';
  }
  if (lower.startsWith('mongodb://') || lower.startsWith('mongodb+srv://')) {
    return 'mongodb';
  }
  if (lower.startsWith('redis://')) {
    return 'redis';
  }
  if (lower.endsWith('.csv')) {
    return 'csv';
  }
  if (lower.endsWith('.json')) {
    return 'json';
  }
  if (lower.endsWith('.xml')) {
    return 'xml';
  }
  if (lower.endsWith('.yaml') || lower.endsWith('.yml')) {
    return 'yaml';
  }
  
  // Default to PostgreSQL for backward compatibility
  return 'postgresql';
}

/**
 * Parse connection string into config
 */
export function parseConnectionString(connectionString: string): ConnectionConfig {
  const type = detectDatabaseType(connectionString);
  
  // For file-based formats
  if (['csv', 'json', 'xml', 'yaml', 'sqlite'].includes(type)) {
    return {
      type,
      filePath: connectionString.replace(/^(sqlite|csv|json|xml|yaml):\/\//, ''),
    };
  }
  
  // For database URLs
  try {
    const url = new URL(connectionString);
    return {
      type,
      url: connectionString,
      host: url.hostname,
      port: url.port ? parseInt(url.port) : undefined,
      database: url.pathname.slice(1),
      username: url.username,
      password: url.password,
    };
  } catch (error) {
    // Fallback for non-URL formats
    return {
      type,
      url: connectionString,
    };
  }
}

/**
 * Create database adapter from connection string or config
 */
export async function createDatabaseAdapter(
  connectionStringOrConfig: string | ConnectionConfig
): Promise<IDatabaseAdapter> {
  const config = typeof connectionStringOrConfig === 'string'
    ? parseConnectionString(connectionStringOrConfig)
    : connectionStringOrConfig;
  
  switch (config.type) {
    case 'postgresql':
      return new PostgreSQLAdapter(config);
    
    case 'mysql':
    case 'mariadb':
      return new MySQLAdapter(config);
    
    case 'sqlite':
      return new SQLiteAdapter(config);
    
    case 'csv':
      return new CSVAdapter(config);
    
    case 'json':
      return new JSONAdapter(config);
    
    case 'xml':
      return new XMLAdapter(config);
    
    case 'sqlserver':
    case 'oracle':
    case 'mongodb':
    case 'redis':
    case 'couchdb':
    case 'cassandra':
    case 'dynamodb':
    case 'firestore':
    case 'bigquery':
    case 'cosmosdb':
    case 'yaml':
    case 'parquet':
      throw new Error(`Database type '${config.type}' is not yet implemented. Currently supported: PostgreSQL, MySQL, SQLite, CSV, JSON, XML`);
    
    default:
      throw new Error(`Unknown database type: ${(config as ConnectionConfig).type}`);
  }
}

/**
 * Get list of supported database types
 */
export function getSupportedDatabaseTypes(): DatabaseType[] {
  return [
    'postgresql',
    'mysql',
    'mariadb',
    'sqlite',
    'csv',
    'json',
    'xml',
  ];
}

/**
 * Get list of planned database types
 */
export function getPlannedDatabaseTypes(): DatabaseType[] {
  return [
    'sqlserver',
    'oracle',
    'mongodb',
    'redis',
    'couchdb',
    'cassandra',
    'yaml',
    'parquet',
    'dynamodb',
    'firestore',
    'bigquery',
    'cosmosdb',
  ];
}
