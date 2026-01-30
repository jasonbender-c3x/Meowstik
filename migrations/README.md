# Database Migrations

This directory contains SQL migration scripts for the Meowstik database.

## How to Apply Migrations

### Option 1: Using Drizzle Kit (Recommended)

```bash
# Push schema changes to database
npm run db:push
```

This will automatically sync the database with the schema defined in `shared/schema.ts`.

### Option 2: Manual SQL Execution

If you need to apply migrations manually (e.g., in production):

```bash
# Using psql
psql $DATABASE_URL -f migrations/0001_add_userid_to_knowledge_buckets.sql

# Or using Node.js
node -e "
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const sql = fs.readFileSync('migrations/0001_add_userid_to_knowledge_buckets.sql', 'utf8');
pool.query(sql).then(() => console.log('Migration applied')).catch(console.error).finally(() => pool.end());
"
```

## Available Migrations

### 0001_add_userid_to_knowledge_buckets.sql
**Date**: 2026-01-15  
**Purpose**: Fix critical security vulnerability in knowledge bucket system

**Changes**:
- Adds `user_id` and `is_guest` columns to `evidence` table
- Adds `user_id` and `is_guest` columns to `knowledge_embeddings` table
- Creates indexes for efficient userId filtering
- Marks existing data as guest data for backward compatibility

**Impact**: 
- Enables proper data isolation between users
- Prevents cross-user data leakage in knowledge bucket retrieval
- Improves query performance with new indexes

**Required for**: All deployments using the knowledge bucket/evidence system

## Migration Best Practices

1. **Always backup** your database before applying migrations
2. **Test migrations** on a development/staging environment first
3. **Review the SQL** to understand what changes will be made
4. **Check dependencies** - some migrations may require others to be applied first
5. **Monitor performance** - indexes can take time to build on large tables

## Rollback

If you need to rollback a migration, you can manually drop the added columns:

```sql
-- Rollback 0001_add_userid_to_knowledge_buckets.sql
DROP INDEX IF EXISTS idx_knowledge_embeddings_bucket_user;
DROP INDEX IF EXISTS idx_knowledge_embeddings_user_id;
DROP INDEX IF EXISTS idx_evidence_bucket_user;
DROP INDEX IF EXISTS idx_evidence_user_id;

ALTER TABLE knowledge_embeddings DROP COLUMN IF EXISTS is_guest;
ALTER TABLE knowledge_embeddings DROP COLUMN IF EXISTS user_id;
ALTER TABLE evidence DROP COLUMN IF EXISTS is_guest;
ALTER TABLE evidence DROP COLUMN IF EXISTS user_id;
```

## Schema Management Philosophy

Meowstik uses **Drizzle ORM** as the source of truth for the database schema:

1. Schema is defined in TypeScript (`shared/schema.ts`)
2. Changes are made to the TypeScript schema first
3. `npm run db:push` syncs the database with the schema
4. Manual migrations are provided as reference and for production deployments

This approach gives us:
- Type safety (TypeScript types generated from schema)
- Single source of truth (no drift between code and database)
- Easy development (automatic sync with `db:push`)
- Production control (manual migrations when needed)
