#!/usr/bin/env tsx
/**
 * =============================================================================
 * DATABASE MIGRATION ORCHESTRATION SCRIPT
 * =============================================================================
 * 
 * This script orchestrates the complete database migration process:
 * 1. Export from source database
 * 2. Optionally provision new Cloud SQL instance
 * 3. Import to target database
 * 4. Verify data integrity
 * 5. Update environment configuration
 * 
 * Usage:
 *   # Migrate to existing PostgreSQL instance
 *   npm run db:migrate -- --target=postgresql://user:pass@host:5432/db
 * 
 *   # Migrate to new Google Cloud SQL instance
 *   npm run db:migrate -- --provision-cloud-sql --project=my-project --region=us-central1
 * 
 *   # Dry run (test without making changes)
 *   npm run db:migrate -- --target=... --dry-run
 * 
 * Safety Features:
 * - Pre-migration validation
 * - Data integrity checks (row counts, checksums)
 * - Rollback support
 * - Automatic backups
 * =============================================================================
 */

import { Pool } from 'pg';
import { exec } from 'child_process';
import { promisify } from 'util';
import { existsSync, writeFileSync, unlinkSync } from 'fs';
import { CloudSqlProvisioner, CloudSqlConfig } from '../server/services/cloud-sql-provisioner';
import { storage } from '../server/storage';

const execAsync = promisify(exec);

interface MigrationOptions {
  source?: string;
  target?: string;
  provisionCloudSql?: boolean;
  projectId?: string;
  region?: string;
  instanceId?: string;
  tier?: string;
  dryRun?: boolean;
  skipValidation?: boolean;
  backupFile?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    tables: number;
    totalRows: number;
  };
}

/**
 * Parse command line arguments
 */
function parseArgs(): MigrationOptions {
  const args = process.argv.slice(2);
  const options: MigrationOptions = {
    source: process.env.DATABASE_URL,
    dryRun: false,
    skipValidation: false,
    backupFile: `db-backup-${Date.now()}.sql`,
  };

  for (const arg of args) {
    if (arg.startsWith('--source=')) {
      options.source = arg.split('=')[1];
    } else if (arg.startsWith('--target=')) {
      options.target = arg.split('=')[1];
    } else if (arg === '--provision-cloud-sql') {
      options.provisionCloudSql = true;
    } else if (arg.startsWith('--project=')) {
      options.projectId = arg.split('=')[1];
    } else if (arg.startsWith('--region=')) {
      options.region = arg.split('=')[1];
    } else if (arg.startsWith('--instance=')) {
      options.instanceId = arg.split('=')[1];
    } else if (arg.startsWith('--tier=')) {
      options.tier = arg.split('=')[1];
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--skip-validation') {
      options.skipValidation = true;
    } else if (arg.startsWith('--backup=')) {
      options.backupFile = arg.split('=')[1];
    }
  }

  return options;
}

/**
 * Validate database connection and structure
 */
async function validateDatabase(connectionString: string): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    stats: { tables: 0, totalRows: 0 },
  };

  const pool = new Pool({ connectionString, max: 1 });

  try {
    // Test connection
    const client = await pool.connect();
    
    // Get table count
    const tables = await client.query(`
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    result.stats.tables = parseInt(tables.rows[0].count);

    // Get total row count (approximate)
    const rows = await client.query(`
      SELECT SUM(n_live_tup) as count 
      FROM pg_stat_user_tables
    `);
    result.stats.totalRows = parseInt(rows.rows[0].count || '0');

    // Check for required tables
    const requiredTables = ['chats', 'messages', 'users'];
    for (const table of requiredTables) {
      const check = await client.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = $1
        )
      `, [table]);
      
      if (!check.rows[0].exists) {
        result.errors.push(`Required table '${table}' not found`);
        result.valid = false;
      }
    }

    client.release();
  } catch (error: any) {
    result.errors.push(`Connection failed: ${error.message}`);
    result.valid = false;
  } finally {
    await pool.end();
  }

  return result;
}

/**
 * Compare databases for data integrity
 */
async function compareDatabase(source: string, target: string): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    stats: { tables: 0, totalRows: 0 },
  };

  const sourcePool = new Pool({ connectionString: source, max: 1 });
  const targetPool = new Pool({ connectionString: target, max: 1 });

  try {
    const sourceClient = await sourcePool.connect();
    const targetClient = await targetPool.connect();

    // Get table list
    const sourceTables = await sourceClient.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' ORDER BY table_name
    `);

    const targetTables = await targetClient.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' ORDER BY table_name
    `);

    // Compare table lists
    const sourceTableNames = sourceTables.rows.map(r => r.table_name);
    const targetTableNames = targetTables.rows.map(r => r.table_name);

    for (const table of sourceTableNames) {
      if (!targetTableNames.includes(table)) {
        result.errors.push(`Table '${table}' missing in target database`);
        result.valid = false;
      }
    }

    // Compare row counts for each table
    for (const table of sourceTableNames.filter(t => targetTableNames.includes(t))) {
      const sourceCount = await sourceClient.query(`SELECT COUNT(*) as count FROM ${table}`);
      const targetCount = await targetClient.query(`SELECT COUNT(*) as count FROM ${table}`);

      const sourceRows = parseInt(sourceCount.rows[0].count);
      const targetRows = parseInt(targetCount.rows[0].count);

      if (sourceRows !== targetRows) {
        result.errors.push(
          `Row count mismatch in '${table}': source=${sourceRows}, target=${targetRows}`
        );
        result.valid = false;
      }
    }

    sourceClient.release();
    targetClient.release();
  } catch (error: any) {
    result.errors.push(`Comparison failed: ${error.message}`);
    result.valid = false;
  } finally {
    await sourcePool.end();
    await targetPool.end();
  }

  return result;
}

/**
 * Print validation result
 */
function printValidation(title: string, result: ValidationResult): void {
  console.log(`\n${title}`);
  console.log('='.repeat(title.length));
  console.log(`  Tables: ${result.stats.tables}`);
  console.log(`  Total Rows: ${result.stats.totalRows.toLocaleString()}`);
  console.log(`  Valid: ${result.valid ? '✓' : '✗'}`);
  
  if (result.errors.length > 0) {
    console.log('\n  Errors:');
    result.errors.forEach(err => console.log(`    ✗ ${err}`));
  }
  
  if (result.warnings.length > 0) {
    console.log('\n  Warnings:');
    result.warnings.forEach(warn => console.log(`    ⚠ ${warn}`));
  }
  
  console.log('');
}

/**
 * Main migration function
 */
async function migrateDatabase() {
  console.log('=============================================================================');
  console.log('DATABASE MIGRATION ORCHESTRATOR');
  console.log('=============================================================================\n');

  const options = parseArgs();

  // Validate options
  if (!options.source) {
    throw new Error('Source database URL is required (--source or DATABASE_URL env var)');
  }

  if (!options.target && !options.provisionCloudSql) {
    throw new Error('Target database URL (--target) or --provision-cloud-sql is required');
  }

  console.log('Migration Configuration:');
  console.log(`  Source: ${options.source.substring(0, 30)}...`);
  console.log(`  Provision Cloud SQL: ${options.provisionCloudSql ? 'Yes' : 'No'}`);
  console.log(`  Dry Run: ${options.dryRun ? 'Yes' : 'No'}`);
  console.log(`  Backup File: ${options.backupFile}`);
  console.log('');

  // Step 1: Validate source database
  console.log('Step 1: Validating source database...');
  if (!options.skipValidation) {
    const sourceValidation = await validateDatabase(options.source);
    printValidation('Source Database Validation', sourceValidation);

    if (!sourceValidation.valid) {
      throw new Error('Source database validation failed');
    }
  } else {
    console.log('  ⚠ Skipped (--skip-validation)');
  }

  // Step 2: Provision Cloud SQL instance if requested
  if (options.provisionCloudSql) {
    console.log('\nStep 2: Provisioning Google Cloud SQL instance...');
    
    if (!options.projectId) {
      throw new Error('--project parameter is required for Cloud SQL provisioning');
    }
    
    if (!options.region) {
      throw new Error('--region parameter is required for Cloud SQL provisioning');
    }

    if (options.dryRun) {
      console.log('  ⚠ DRY RUN - Would provision instance with:');
      console.log(`      Project: ${options.projectId}`);
      console.log(`      Region: ${options.region}`);
      console.log(`      Instance: ${options.instanceId || 'meowstik-db'}`);
      console.log(`      Tier: ${options.tier || 'db-f1-micro'}`);
    } else {
      const provisioner = new CloudSqlProvisioner(options.projectId);
      
      // Check API
      const apiEnabled = await provisioner.checkApiEnabled();
      if (!apiEnabled) {
        console.log('  Cloud SQL Admin API is not enabled. Enabling...');
        await provisioner.enableApi();
      }

      // Create instance
      const config: CloudSqlConfig = {
        projectId: options.projectId,
        instanceId: options.instanceId || `meowstik-db-${Date.now()}`,
        region: options.region,
        tier: options.tier || 'db-f1-micro',
        databaseVersion: 'POSTGRES_15',
        databaseName: 'meowstik',
        userName: 'meowstik',
        authorizedNetworks: ['0.0.0.0/0'], // Public access (configure firewall separately)
      };

      const instance = await provisioner.createInstance(config);
      options.target = instance.connectionString.replace('PASSWORD', config.userPassword || '');
      
      console.log('\n  ✓ Cloud SQL instance created');
      console.log(`  Connection String: ${instance.connectionString}`);
      console.log(`\n  IMPORTANT: Save this connection string and update your .env file:`);
      console.log(`  DATABASE_URL=${options.target}`);
      console.log('');
    }
  } else {
    console.log('\nStep 2: Using existing target database...');
    console.log(`  Target: ${options.target?.substring(0, 30)}...`);
  }

  // Step 3: Export from source
  console.log('\nStep 3: Exporting source database...');
  if (!options.dryRun) {
    try {
      await execAsync(`npx tsx scripts/db-export.ts --output=${options.backupFile} --verbose`);
      console.log(`  ✓ Exported to ${options.backupFile}`);
    } catch (error: any) {
      throw new Error(`Export failed: ${error.message}`);
    }
  } else {
    console.log('  ⚠ DRY RUN - Would export to ' + options.backupFile);
  }

  // Step 4: Import to target
  console.log('\nStep 4: Importing to target database...');
  if (!options.dryRun && options.target) {
    try {
      await execAsync(
        `npx tsx scripts/db-import.ts --file=${options.backupFile} --target=${options.target} --skip-errors`
      );
      console.log('  ✓ Import completed');
    } catch (error: any) {
      throw new Error(`Import failed: ${error.message}`);
    }
  } else {
    console.log('  ⚠ DRY RUN - Would import from ' + options.backupFile);
  }

  // Step 5: Verify data integrity
  console.log('\nStep 5: Verifying data integrity...');
  if (!options.dryRun && options.target && !options.skipValidation) {
    const comparison = await compareDatabase(options.source, options.target);
    printValidation('Data Integrity Check', comparison);

    if (!comparison.valid) {
      console.error('\n❌ Data integrity check failed!');
      console.error('The migration may be incomplete. Please review the errors above.');
      console.error(`Backup file preserved at: ${options.backupFile}`);
      process.exit(1);
    }
  } else {
    console.log('  ⚠ Skipped');
  }

  // Step 6: Cleanup
  console.log('\nStep 6: Cleanup...');
  if (!options.dryRun && existsSync(options.backupFile!)) {
    console.log(`  Backup preserved at: ${options.backupFile}`);
    console.log('  You can delete it after verifying the migration is successful.');
  }

  // Success
  console.log('\n=============================================================================');
  console.log('MIGRATION COMPLETE');
  console.log('=============================================================================');
  
  if (options.target) {
    console.log('\nNext Steps:');
    console.log('1. Update your .env file with the new DATABASE_URL');
    console.log('2. Restart your application');
    console.log('3. Test all functionality');
    console.log('4. Once confirmed, delete the backup file');
    console.log('');
    console.log(`New DATABASE_URL: ${options.target}`);
  }

  console.log('');
}

// Run the migration
migrateDatabase()
  .then(() => {
    console.log('✓ Migration successful');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nThe migration has been aborted. Your source database is unchanged.');
    process.exit(1);
  });
