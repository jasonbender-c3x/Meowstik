# Database Migration Guide

This guide covers how to migrate your Meowstik PostgreSQL database from Replit to your home development server or Google Cloud SQL.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Migration Methods](#migration-methods)
4. [Export/Import Tools](#exportimport-tools)
5. [Google Cloud SQL Provisioning](#google-cloud-sql-provisioning)
6. [Complete Migration Process](#complete-migration-process)
7. [Troubleshooting](#troubleshooting)

## Overview

Meowstik provides three main tools for database migration:

- **`npm run db:export`** - Export database schema and data to SQL file
- **`npm run db:import`** - Import SQL file into PostgreSQL instance
- **`npm run db:migrate`** - Orchestrate complete migration with validation

## Prerequisites

### For Any Migration

- Node.js 20 or higher
- PostgreSQL 14 or higher on target server
- Network access between source and target databases

### For Google Cloud SQL

- Google Cloud account with billing enabled
- Service account with Cloud SQL Admin role
- `GOOGLE_APPLICATION_CREDENTIALS` environment variable set
- `GOOGLE_CLOUD_PROJECT` environment variable set

## Migration Methods

### Method 1: Manual Export/Import (Recommended for Home Server)

Best for migrating to an existing PostgreSQL instance on your home server.

#### Step 1: Export Current Database

```bash
npm run db:export -- --output=production-backup.sql --verbose
```

Options:
- `--output=FILE` - Output file name (default: `db-export.sql`)
- `--compress` - Gzip compress the output (adds `.gz` extension)
- `--data-only` - Export only data (no schema)
- `--schema-only` - Export only schema (no data)
- `--verbose` - Show detailed progress

#### Step 2: Copy to Target Server

```bash
# Using scp
scp production-backup.sql user@homeserver:/path/to/backup/

# Or using rsync
rsync -avz production-backup.sql user@homeserver:/path/to/backup/
```

#### Step 3: Import to Target Database

On your home server:

```bash
npm run db:import -- --file=production-backup.sql --target=postgresql://user:pass@localhost:5432/meowstik
```

Options:
- `--file=FILE` - SQL file to import (required)
- `--target=URL` - Target database URL (default: `DATABASE_URL` env var)
- `--dry-run` - Preview without executing
- `--skip-errors` - Continue on non-critical errors
- `--verbose` - Show detailed progress

### Method 2: Automated Migration (Recommended for Validation)

Uses the migration orchestrator to handle the entire process with validation.

```bash
npm run db:migrate -- --target=postgresql://user:pass@homeserver:5432/meowstik
```

This will:
1. ✓ Validate source database
2. ✓ Export database with backup
3. ✓ Import to target database
4. ✓ Verify data integrity (row counts)
5. ✓ Provide rollback instructions if needed

Options:
- `--source=URL` - Source database (default: current `DATABASE_URL`)
- `--target=URL` - Target database URL
- `--dry-run` - Test without making changes
- `--skip-validation` - Skip validation checks (not recommended)
- `--backup=FILE` - Custom backup filename

### Method 3: Google Cloud SQL Provisioning

Automatically provision a new Google Cloud SQL instance and migrate.

```bash
npm run db:migrate -- \
  --provision-cloud-sql \
  --project=my-gcp-project \
  --region=us-central1 \
  --tier=db-f1-micro
```

Options:
- `--provision-cloud-sql` - Enable Cloud SQL provisioning
- `--project=ID` - Google Cloud project ID (required)
- `--region=REGION` - GCP region (required, e.g., `us-central1`, `europe-west1`)
- `--instance=NAME` - Instance name (default: auto-generated)
- `--tier=TIER` - Machine type (default: `db-f1-micro`)

Available tiers:
- `db-f1-micro` - Shared-core, 0.6 GB RAM (~$7.67/month)
- `db-g1-small` - Shared-core, 1.7 GB RAM (~$24/month)
- `db-n1-standard-1` - 1 vCPU, 3.75 GB RAM (~$46/month)
- `db-n1-standard-2` - 2 vCPU, 7.5 GB RAM (~$92/month)

## Export/Import Tools

### Database Export Tool

```bash
# Basic export
npm run db:export

# Compressed export (recommended for large databases)
npm run db:export -- --compress --output=backup.sql.gz

# Schema only (for reviewing structure)
npm run db:export -- --schema-only --output=schema.sql

# Data only (if schema already exists)
npm run db:export -- --data-only --output=data.sql
```

The export tool:
- Exports all tables defined in `shared/schema.ts`
- Handles JSON/JSONB fields correctly
- Escapes special characters
- Uses `ON CONFLICT DO NOTHING` for safe re-imports
- Supports gzip compression for large datasets

### Database Import Tool

```bash
# Basic import
npm run db:import -- --file=backup.sql --target=postgresql://...

# Dry run (preview without executing)
npm run db:import -- --file=backup.sql --target=postgresql://... --dry-run

# Skip errors (continue on non-critical failures)
npm run db:import -- --file=backup.sql --target=postgresql://... --skip-errors
```

The import tool:
- Validates connection before importing
- Uses transactions (all-or-nothing)
- Supports compressed files (.gz)
- Provides detailed error reporting
- Can skip non-critical errors

## Google Cloud SQL Provisioning

### Setup

1. **Enable Cloud SQL Admin API**

```bash
gcloud services enable sqladmin.googleapis.com --project=YOUR_PROJECT_ID
```

2. **Create Service Account**

```bash
gcloud iam service-accounts create meowstik-db-admin \
  --display-name="Meowstik DB Admin" \
  --project=YOUR_PROJECT_ID

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:meowstik-db-admin@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudsql.admin"
```

3. **Download Service Account Key**

```bash
gcloud iam service-accounts keys create ~/meowstik-sa-key.json \
  --iam-account=meowstik-db-admin@YOUR_PROJECT_ID.iam.gserviceaccount.com
```

4. **Set Environment Variable**

```bash
export GOOGLE_APPLICATION_CREDENTIALS=~/meowstik-sa-key.json
export GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID
```

### Provision Instance

```bash
npm run db:migrate -- \
  --provision-cloud-sql \
  --project=YOUR_PROJECT_ID \
  --region=us-central1 \
  --tier=db-f1-micro \
  --instance=meowstik-production
```

This creates:
- PostgreSQL 15 instance
- Database named `meowstik`
- User named `meowstik` with secure generated password
- Public IP with authorized networks
- Automated daily backups at 3 AM UTC

**IMPORTANT**: Save the connection string output by the script. You'll need it to update your `.env` file.

### Configure Application

Update your `.env` file:

```bash
DATABASE_URL=postgresql://meowstik:GENERATED_PASSWORD@IP_ADDRESS:5432/meowstik
```

### Security Considerations

1. **Authorized Networks**: By default, the instance allows connections from any IP (`0.0.0.0/0`). After migration, update to restrict access:

```bash
gcloud sql instances patch INSTANCE_NAME \
  --authorized-networks=YOUR_HOME_IP/32 \
  --project=YOUR_PROJECT_ID
```

2. **Private IP**: For production, consider using Cloud SQL Proxy or Private IP:

```bash
# Install Cloud SQL Proxy
curl -o cloud-sql-proxy https://storage.googleapis.com/cloud-sql-connectors/cloud-sql-proxy/v2.8.0/cloud-sql-proxy.linux.amd64
chmod +x cloud-sql-proxy

# Run proxy
./cloud-sql-proxy --credentials-file=~/meowstik-sa-key.json \
  YOUR_PROJECT_ID:REGION:INSTANCE_NAME
```

## Complete Migration Process

### Step-by-Step Guide

#### 1. Pre-Migration Checklist

- [ ] Backup current database
- [ ] Test connection to target database
- [ ] Verify disk space on target server
- [ ] Schedule maintenance window (if needed)
- [ ] Notify users of potential downtime

#### 2. Execute Migration

```bash
# Option A: To existing PostgreSQL
npm run db:migrate -- --target=postgresql://user:pass@homeserver:5432/meowstik

# Option B: To new Cloud SQL instance
npm run db:migrate -- \
  --provision-cloud-sql \
  --project=my-project \
  --region=us-central1
```

#### 3. Validation

The migration tool automatically validates:
- Source database connectivity
- Required tables exist
- Row counts match between source and target
- No data corruption

#### 4. Update Application

```bash
# Update .env file
echo "DATABASE_URL=NEW_CONNECTION_STRING" >> .env

# Restart application
npm run start
```

#### 5. Post-Migration Testing

Test all critical features:
- [ ] User authentication
- [ ] Chat functionality
- [ ] Message history
- [ ] File attachments
- [ ] Google Workspace integration
- [ ] API endpoints

#### 6. Cleanup

After confirming successful migration:

```bash
# Delete backup file
rm db-backup-*.sql

# Optional: Delete old Replit database
# (ONLY after fully verified)
```

## Troubleshooting

### Export Fails: "Connection Timeout"

**Cause**: Source database is slow or overloaded.

**Solution**:
```bash
# Increase connection timeout
export PGCONNECT_TIMEOUT=30
npm run db:export
```

### Import Fails: "Constraint Violation"

**Cause**: Target database has conflicting data.

**Solution**:
```bash
# Drop and recreate database
psql -U user -c "DROP DATABASE meowstik;"
psql -U user -c "CREATE DATABASE meowstik;"

# Re-run import
npm run db:import -- --file=backup.sql --target=...
```

### Cloud SQL Provisioning: "API Not Enabled"

**Cause**: Cloud SQL Admin API is not enabled in your project.

**Solution**:
```bash
gcloud services enable sqladmin.googleapis.com --project=YOUR_PROJECT_ID

# Wait 2-3 minutes for API to propagate
npm run db:migrate -- --provision-cloud-sql ...
```

### Migration Validation Failed

**Cause**: Row counts don't match between source and target.

**Solution**:
1. Check the backup file for errors:
   ```bash
   less db-backup-*.sql
   ```

2. Try re-importing with error skipping:
   ```bash
   npm run db:import -- --file=backup.sql --target=... --skip-errors --verbose
   ```

3. Manually verify specific tables:
   ```sql
   -- On source
   SELECT COUNT(*) FROM chats;
   
   -- On target
   SELECT COUNT(*) FROM chats;
   ```

### Connection Refused to Cloud SQL

**Cause**: IP not authorized or instance not ready.

**Solution**:
```bash
# Check instance status
gcloud sql instances describe INSTANCE_NAME --project=YOUR_PROJECT_ID

# Add your IP to authorized networks
gcloud sql instances patch INSTANCE_NAME \
  --authorized-networks=YOUR_IP/32 \
  --project=YOUR_PROJECT_ID
```

### Out of Memory During Export

**Cause**: Large database exceeds available memory.

**Solution**:
```bash
# Use compressed export
npm run db:export -- --compress

# Or export data only (without large binary fields)
npm run db:export -- --data-only
```

## Best Practices

1. **Always Test First**: Use `--dry-run` to preview changes
2. **Keep Backups**: Never delete backups until fully verified
3. **Use Transactions**: Let the tools handle atomicity
4. **Validate Data**: Always run post-migration validation
5. **Monitor Performance**: Check query performance after migration
6. **Document Changes**: Keep records of connection strings and configurations

## Getting Help

If you encounter issues:

1. Check the error messages carefully
2. Review the backup SQL file for corruption
3. Verify network connectivity between servers
4. Check PostgreSQL logs on both source and target
5. Ensure sufficient disk space and permissions

For additional support, consult:
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Google Cloud SQL Documentation](https://cloud.google.com/sql/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
