#!/usr/bin/env tsx
/**
 * =============================================================================
 * DATABASE IMPORT UTILITY
 * =============================================================================
 * 
 * This script imports a database export file into a PostgreSQL instance.
 * Supports both compressed (.gz) and uncompressed (.sql) files.
 * 
 * Usage:
 *   npm run db:import -- --file=db-export.sql
 *   npm run db:import -- --file=db-export.sql.gz
 *   npm run db:import -- --file=export.sql --target=postgresql://user:pass@host:5432/db
 *   npm run db:import -- --file=export.sql --dry-run  # Test without executing
 * 
 * Safety Features:
 * - Dry-run mode to preview changes
 * - Connection validation before import
 * - Transaction support (all-or-nothing)
 * - Progress reporting
 * =============================================================================
 */

import { Pool } from 'pg';
import { readFileSync, existsSync } from 'fs';
import { createGunzip } from 'zlib';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';

interface ImportOptions {
  file: string;
  target?: string;
  dryRun?: boolean;
  verbose?: boolean;
  skipErrors?: boolean;
}

/**
 * Parse command line arguments
 */
function parseArgs(): ImportOptions {
  const args = process.argv.slice(2);
  const options: ImportOptions = {
    file: '',
    target: process.env.DATABASE_URL,
    dryRun: false,
    verbose: false,
    skipErrors: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--file=')) {
      options.file = arg.split('=')[1];
    } else if (arg.startsWith('--target=')) {
      options.target = arg.split('=')[1];
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--verbose' || arg === '-v') {
      options.verbose = true;
    } else if (arg === '--skip-errors') {
      options.skipErrors = true;
    }
  }

  if (!options.file) {
    throw new Error('--file parameter is required');
  }

  if (!options.target) {
    throw new Error('--target parameter or DATABASE_URL environment variable is required');
  }

  return options;
}

/**
 * Read SQL file (handles both compressed and uncompressed)
 */
async function readSqlFile(filePath: string): Promise<string> {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  if (filePath.endsWith('.gz')) {
    // Decompress gzip file
    console.log('  Decompressing gzip file...');
    const chunks: Buffer[] = [];
    const input = createReadStream(filePath);
    const gunzip = createGunzip();

    gunzip.on('data', (chunk) => chunks.push(chunk));

    await pipeline(input, gunzip);
    return Buffer.concat(chunks).toString('utf-8');
  } else {
    // Read plain text file
    return readFileSync(filePath, 'utf-8');
  }
}

/**
 * Parse SQL into individual statements
 */
function parseSqlStatements(sql: string): string[] {
  // Remove comments
  sql = sql.replace(/--.*$/gm, '');
  
  // Split by semicolons (basic parsing, doesn't handle all edge cases)
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  return statements;
}

/**
 * Validate database connection
 */
async function validateConnection(connectionString: string): Promise<boolean> {
  const pool = new Pool({ connectionString, max: 1 });
  
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT version()');
    client.release();
    await pool.end();
    
    console.log(`  ✓ Connected to: ${result.rows[0].version}`);
    return true;
  } catch (error) {
    await pool.end();
    throw new Error(`Connection failed: ${error}`);
  }
}

/**
 * Execute SQL statements
 */
async function executeSql(
  connectionString: string,
  statements: string[],
  options: ImportOptions
): Promise<{ executed: number; failed: number; errors: string[] }> {
  const pool = new Pool({ connectionString });
  const stats = {
    executed: 0,
    failed: 0,
    errors: [] as string[],
  };

  if (options.dryRun) {
    console.log('\n  DRY RUN MODE - No changes will be made\n');
    console.log(`  Would execute ${statements.length} SQL statements`);
    await pool.end();
    return stats;
  }

  const client = await pool.connect();

  try {
    // Start transaction for atomicity
    await client.query('BEGIN');

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      
      try {
        await client.query(stmt);
        stats.executed++;
        
        if (options.verbose && i % 100 === 0) {
          console.log(`  Progress: ${i + 1}/${statements.length} statements`);
        }
      } catch (error: any) {
        stats.failed++;
        const errorMsg = `Statement ${i + 1}: ${error.message}`;
        stats.errors.push(errorMsg);
        
        if (!options.skipErrors) {
          throw new Error(`SQL execution failed: ${errorMsg}`);
        } else if (options.verbose) {
          console.warn(`  ⚠ Warning: ${errorMsg}`);
        }
      }
    }

    // Commit transaction
    await client.query('COMMIT');
    console.log('  ✓ Transaction committed');
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error('  ✗ Transaction rolled back');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }

  return stats;
}

/**
 * Main import function
 */
async function importDatabase() {
  console.log('=============================================================================');
  console.log('DATABASE IMPORT UTILITY');
  console.log('=============================================================================\n');

  const options = parseArgs();
  
  console.log('Options:');
  console.log(`  File: ${options.file}`);
  console.log(`  Target: ${options.target?.substring(0, 30)}...`);
  console.log(`  Dry Run: ${options.dryRun}`);
  console.log(`  Skip Errors: ${options.skipErrors}`);
  console.log('');

  // Validate connection
  console.log('Validating connection...');
  await validateConnection(options.target!);

  // Read SQL file
  console.log('\nReading SQL file...');
  const sql = await readSqlFile(options.file);
  console.log(`  ✓ Read ${(Buffer.byteLength(sql, 'utf8') / 1024 / 1024).toFixed(2)} MB`);

  // Parse statements
  console.log('\nParsing SQL statements...');
  const statements = parseSqlStatements(sql);
  console.log(`  ✓ Found ${statements.length} statements`);

  if (options.dryRun) {
    console.log('\n--- DRY RUN MODE ---');
    console.log('First 5 statements:');
    statements.slice(0, 5).forEach((stmt, i) => {
      console.log(`\n[${i + 1}]:\n${stmt.substring(0, 200)}${stmt.length > 200 ? '...' : ''}`);
    });
    console.log('\n--- END DRY RUN ---\n');
  }

  // Execute import
  console.log('\nExecuting import...');
  const stats = await executeSql(options.target!, statements, options);

  // Print results
  console.log('\n=============================================================================');
  console.log('IMPORT COMPLETE');
  console.log('=============================================================================');
  console.log(`  Executed: ${stats.executed} statements`);
  if (stats.failed > 0) {
    console.log(`  Failed: ${stats.failed} statements`);
    console.log('\nErrors:');
    stats.errors.forEach(err => console.log(`  - ${err}`));
  }
  console.log('');
}

// Run the import
importDatabase()
  .then(() => {
    console.log('✓ Import successful');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Import failed:', error.message);
    process.exit(1);
  });
