# Database Migration - Implementation Guide

A practical, step-by-step guide to implementing database migration for Meowstik.

## Quick Start - 5 Minutes

### 1. Export Your Current Database

```bash
# Basic export (creates db-export.sql)
npm run db:export

# Compressed export (recommended for large databases)
npm run db:export -- --compress --output=meowstik-backup.sql.gz
```

**What happens:** Creates a SQL file with your complete database (schema + data).

### 2. Import to New Database

```bash
# Import to home server
npm run db:import -- \
  --file=meowstik-backup.sql.gz \
  --target=postgresql://user:password@homeserver:5432/meowstik

# Or use environment variable
export DATABASE_URL="postgresql://user:password@homeserver:5432/meowstik"
npm run db:import -- --file=meowstik-backup.sql.gz
```

**What happens:** Imports the SQL file into your target database with validation.

### 3. Update Your Application

```bash
# Update .env file
echo "DATABASE_URL=postgresql://user:password@homeserver:5432/meowstik" > .env

# Restart application
npm run start
```

**Done!** Your database is migrated.

---

## Implementation Scenarios

### Scenario A: Migrate to Home Server (Existing PostgreSQL)

**Prerequisites:**
- PostgreSQL 14+ installed on home server
- Database created: `createdb meowstik`
- User with permissions: `GRANT ALL ON DATABASE meowstik TO youruser`

**Steps:**

```bash
# 1. Export from Replit/current server
npm run db:export -- --compress --output=backup.sql.gz

# 2. Copy to home server
scp backup.sql.gz user@homeserver:/tmp/

# 3. SSH to home server and import
ssh user@homeserver
cd /path/to/meowstik
npm run db:import -- --file=/tmp/backup.sql.gz

# 4. Update .env
vim .env
# Change DATABASE_URL to local PostgreSQL

# 5. Test connection
npm run start
```

### Scenario B: Auto-Provision Google Cloud SQL

**Prerequisites:**
- Google Cloud account with billing enabled
- `gcloud` CLI installed and authenticated
- Cloud SQL Admin API enabled

**Setup (one-time):**

```bash
# 1. Enable API
gcloud services enable sqladmin.googleapis.com --project=YOUR_PROJECT_ID

# 2. Create service account
gcloud iam service-accounts create meowstik-db \
  --display-name="Meowstik Database Admin"

# 3. Grant permissions
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:meowstik-db@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudsql.admin"

# 4. Create and download key
gcloud iam service-accounts keys create ~/meowstik-key.json \
  --iam-account=meowstik-db@YOUR_PROJECT_ID.iam.gserviceaccount.com

# 5. Set environment variables
export GOOGLE_APPLICATION_CREDENTIALS=~/meowstik-key.json
export GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID
```

**Migration:**

```bash
# Auto-provision and migrate in one command
npm run db:migrate -- \
  --provision-cloud-sql \
  --project=YOUR_PROJECT_ID \
  --region=us-central1 \
  --instance=meowstik-prod \
  --tier=db-f1-micro

# The script will:
# 1. Create PostgreSQL 15 instance (~5-10 minutes)
# 2. Create database and user
# 3. Export current data
# 4. Import to Cloud SQL
# 5. Verify data integrity
# 6. Output connection string

# Save the connection string to .env
echo "DATABASE_URL=<connection-string-from-output>" >> .env
```

### Scenario C: Schema-Only Provisioning (New Empty Database)

**Use case:** You want to create a new database with the schema but no data.

```bash
# 1. Export schema only
npm run db:export -- --schema-only --output=schema.sql

# 2. Create new database on target server
psql -U postgres -c "CREATE DATABASE meowstik_test;"

# 3. Import schema
npm run db:import -- \
  --file=schema.sql \
  --target=postgresql://user:pass@host:5432/meowstik_test

# 4. Apply Drizzle migrations (if needed)
DATABASE_URL=postgresql://user:pass@host:5432/meowstik_test npm run db:push
```

### Scenario D: Complete Migration with Validation

**Use case:** Production migration with full validation and rollback capability.

```bash
# One command does everything with safety checks
npm run db:migrate -- \
  --target=postgresql://user:password@newserver:5432/meowstik

# What happens:
# ✓ Validates source database (tables exist, data intact)
# ✓ Creates backup (saved as db-backup-<timestamp>.sql)
# ✓ Exports data with compression
# ✓ Tests target connection
# ✓ Imports data in transaction
# ✓ Compares row counts (source vs target)
# ✓ Reports success or provides rollback instructions
```

---

## API Implementation (Programmatic Access)

### Setup API Routes

**1. Register routes in your Express app:**

```typescript
// In server/index.ts or server/app.ts
import databaseAdminRoutes from './routes/database-admin';

// Add authentication middleware (implement based on your auth system)
const requireAdmin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Register routes with auth
app.use('/api/database', requireAdmin, databaseAdminRoutes);
```

### Using the API

**Export database:**

```bash
curl -X POST http://localhost:5000/api/database/export \
  -H "Content-Type: application/json" \
  -d '{"format": "sql.gz", "includeSchema": true, "includeData": true}' \
  --output backup.sql.gz
```

**Check database health:**

```bash
curl http://localhost:5000/api/database/health
```

**Provision Cloud SQL:**

```bash
curl -X POST http://localhost:5000/api/database/provision-cloud-sql \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "my-gcp-project",
    "instanceId": "meowstik-prod",
    "region": "us-central1",
    "tier": "db-f1-micro"
  }'
```

**Track migration status:**

```bash
curl http://localhost:5000/api/database/migration-status/export-1234567890
```

---

## Common Patterns

### Pattern 1: Daily Automated Backups

Create a cron job for daily backups:

```bash
# Add to crontab: crontab -e
0 2 * * * cd /path/to/meowstik && npm run db:export -- --compress --output=/backups/daily-$(date +\%Y\%m\%d).sql.gz
```

### Pattern 2: Blue-Green Deployment

```bash
# 1. Set up new "green" database
npm run db:migrate -- --target=postgresql://green-server:5432/meowstik

# 2. Test application with green database
DATABASE_URL=postgresql://green-server:5432/meowstik npm run start

# 3. If tests pass, switch production
# Update production .env to point to green database

# 4. Keep blue as rollback option for 24 hours
```

### Pattern 3: Development Database Refresh

```bash
# Weekly: Refresh dev database from production
npm run db:export -- --compress --output=prod-snapshot.sql.gz
npm run db:import -- \
  --file=prod-snapshot.sql.gz \
  --target=postgresql://localhost:5432/meowstik_dev
```

---

## Environment Setup

### Development Environment

```bash
# .env.development
DATABASE_URL=postgresql://localhost:5432/meowstik_dev
NODE_ENV=development
```

### Production Environment

```bash
# .env.production
DATABASE_URL=postgresql://prod-server:5432/meowstik
NODE_ENV=production

# For Cloud SQL (optional)
GOOGLE_CLOUD_PROJECT=my-gcp-project
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

---

## Validation & Testing

### Before Migration (Pre-flight Check)

```bash
# 1. Verify current database is healthy
psql $DATABASE_URL -c "SELECT COUNT(*) FROM chats;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM messages;"

# 2. Test export (dry run)
npm run db:export -- --output=/tmp/test.sql
ls -lh /tmp/test.sql  # Check file created

# 3. Validate export content
head -50 /tmp/test.sql  # Should see CREATE TABLE statements
```

### After Migration (Post-flight Check)

```bash
# 1. Verify row counts match
echo "Source counts:"
psql $SOURCE_DATABASE_URL -c "SELECT COUNT(*) FROM chats;"

echo "Target counts:"
psql $TARGET_DATABASE_URL -c "SELECT COUNT(*) FROM chats;"

# 2. Test application functionality
npm run start
# Test: Create chat, send message, attach file

# 3. Verify no errors in logs
tail -f logs/application.log
```

---

## Troubleshooting

### Issue: "Connection timeout"

```bash
# Increase timeout
export PGCONNECT_TIMEOUT=30
npm run db:export
```

### Issue: "Permission denied on table"

```sql
-- On target database
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO youruser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO youruser;
```

### Issue: "Disk full" during import

```bash
# Check disk space
df -h

# Use data-only import (skip schema)
npm run db:import -- --file=backup.sql --target=... --skip-errors
```

### Issue: "Row count mismatch"

```bash
# 1. Check for errors in import
npm run db:import -- --file=backup.sql --target=... --verbose

# 2. Re-run with error skipping
npm run db:import -- --file=backup.sql --target=... --skip-errors

# 3. Manually verify specific tables
psql $TARGET_DATABASE_URL -c "SELECT COUNT(*) FROM messages;"
```

---

## Performance Tips

### Large Databases (>10GB)

```bash
# 1. Use compression
npm run db:export -- --compress

# 2. Increase buffer sizes on import
psql $TARGET_DATABASE_URL -c "SET maintenance_work_mem = '1GB';"

# 3. Disable indexes during import, rebuild after
psql $TARGET_DATABASE_URL -c "DROP INDEX IF EXISTS idx_messages_chat_id;"
npm run db:import -- --file=backup.sql.gz
psql $TARGET_DATABASE_URL -c "CREATE INDEX idx_messages_chat_id ON messages(chat_id);"
```

### Network-Constrained Environments

```bash
# 1. Export and compress in one step
npm run db:export -- --compress --output=backup.sql.gz

# 2. Use rsync for interrupted transfers
rsync -avz --partial backup.sql.gz user@server:/backups/

# 3. Import with connection pooling
DATABASE_URL=$TARGET_URL?pool_size=10 npm run db:import -- --file=backup.sql.gz
```

---

## Security Checklist

Before production migration:

- [ ] Connection strings use SSL (`?sslmode=require`)
- [ ] Service account keys are secured (not in git)
- [ ] API endpoints have authentication
- [ ] Cloud SQL has IP whitelist configured
- [ ] Database users have minimal required permissions
- [ ] Backups are encrypted at rest
- [ ] Environment variables are not logged

---

## Next Steps

1. **Test in development first**
   - Run export/import on test database
   - Verify application works with migrated data

2. **Plan production migration**
   - Schedule maintenance window
   - Notify users of downtime
   - Prepare rollback plan

3. **Execute migration**
   - Use `npm run db:migrate` for automated process
   - Monitor for errors
   - Verify data integrity

4. **Post-migration**
   - Update DNS/connection strings
   - Monitor application performance
   - Keep backup for 7 days

---

## Support

- **Migration Guide**: `docs/database-migration-guide.md`
- **API Reference**: `server/routes/database-admin.ts`
- **Validation**: `node scripts/validate-migration-tools.cjs`
- **Quick Reference**: `scripts/README-MIGRATION.md`

## Quick Command Reference

```bash
# Export
npm run db:export                                    # Basic
npm run db:export -- --compress                      # Compressed
npm run db:export -- --schema-only                   # Schema only
npm run db:export -- --data-only                     # Data only

# Import
npm run db:import -- --file=backup.sql --target=URL  # Basic
npm run db:import -- --file=backup.sql --dry-run     # Test only
npm run db:import -- --file=backup.sql --skip-errors # Continue on errors

# Complete Migration
npm run db:migrate -- --target=URL                   # Existing DB
npm run db:migrate -- --provision-cloud-sql ...      # New Cloud SQL
npm run db:migrate -- --dry-run                      # Test only

# Validation
node scripts/validate-migration-tools.cjs            # Check setup
```
