# Database Migration Scripts

This directory contains scripts for migrating the Meowstik PostgreSQL database between environments.

## Available Scripts

### Core Migration Tools

#### `db-export.ts`
Export complete database (schema + data) to SQL file.

```bash
# Basic export
npm run db:export

# With compression
npm run db:export -- --compress --output=backup.sql.gz

# Schema only
npm run db:export -- --schema-only

# Data only
npm run db:export -- --data-only
```

**Features:**
- Exports all tables and data
- Supports gzip compression
- Handles JSON/JSONB fields
- Safe re-import with conflict handling

#### `db-import.ts`
Import SQL file into PostgreSQL database.

```bash
# Import to current database
npm run db:import -- --file=backup.sql

# Import to different database
npm run db:import -- --file=backup.sql --target=postgresql://...

# Dry run (preview only)
npm run db:import -- --file=backup.sql --dry-run

# Skip non-critical errors
npm run db:import -- --file=backup.sql --skip-errors
```

**Features:**
- Transaction-based import
- Supports compressed files
- Validates connection first
- Detailed error reporting

#### `db-migrate.ts`
Orchestrate complete migration with validation.

```bash
# Migrate to existing database
npm run db:migrate -- --target=postgresql://user:pass@host:5432/db

# Migrate to new Google Cloud SQL instance
npm run db:migrate -- \
  --provision-cloud-sql \
  --project=my-gcp-project \
  --region=us-central1 \
  --tier=db-f1-micro

# Dry run
npm run db:migrate -- --target=... --dry-run
```

**Features:**
- Pre-migration validation
- Automated export/import
- Data integrity checks
- Cloud SQL provisioning
- Rollback support

### Validation Tools

#### `validate-migration-tools.cjs`
Validates that all migration tools are correctly installed and configured.

```bash
node scripts/validate-migration-tools.cjs
```

Checks:
- All script files exist
- NPM scripts are defined
- Environment variables configured
- Documentation complete
- TypeScript syntax valid

## Usage Examples

### Example 1: Migrate from Replit to Home Server

```bash
# Step 1: Export current database
npm run db:export -- --compress --output=replit-backup.sql.gz

# Step 2: Copy to home server
scp replit-backup.sql.gz user@homeserver:/backups/

# Step 3: On home server, import
npm run db:import -- --file=/backups/replit-backup.sql.gz --target=postgresql://localhost:5432/meowstik
```

### Example 2: Automated Migration with Validation

```bash
# Single command migration with checks
npm run db:migrate -- --target=postgresql://user:pass@homeserver:5432/meowstik
```

This will:
1. Validate source database
2. Export with automatic backup
3. Import to target
4. Verify data integrity
5. Report success/failure

### Example 3: Provision Google Cloud SQL

```bash
# Create new Cloud SQL instance and migrate
npm run db:migrate -- \
  --provision-cloud-sql \
  --project=my-gcp-project \
  --region=us-central1 \
  --instance=meowstik-prod \
  --tier=db-n1-standard-1
```

This will:
1. Enable Cloud SQL API (if needed)
2. Create PostgreSQL 15 instance
3. Configure user and database
4. Export current data
5. Import to new instance
6. Provide connection string

## Environment Variables

Required environment variables:

```bash
# Source database (current)
DATABASE_URL=postgresql://...

# For Google Cloud SQL
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
```

## Common Options

All migration scripts support these common options:

- `--verbose` or `-v` - Show detailed progress
- `--dry-run` - Preview without making changes
- `--help` - Show help message

## Troubleshooting

### "Connection timeout"
Increase timeout in .env:
```bash
PGCONNECT_TIMEOUT=30
```

### "Permission denied"
Ensure user has necessary permissions:
```sql
GRANT ALL PRIVILEGES ON DATABASE meowstik TO username;
```

### "Disk space full"
Use compressed export:
```bash
npm run db:export -- --compress
```

### "Cloud SQL API not enabled"
Enable the API:
```bash
gcloud services enable sqladmin.googleapis.com
```

## Documentation

For detailed documentation, see:
- [Database Migration Guide](../docs/database-migration-guide.md)

## Safety Features

All migration scripts include:
- Connection validation before operations
- Transaction support (all-or-nothing)
- Automatic backups before import
- Data integrity verification
- Detailed error reporting
- Rollback instructions on failure

## Support

For issues or questions:
1. Check error messages carefully
2. Review the migration guide
3. Verify environment variables
4. Check PostgreSQL logs
5. Run validation script
