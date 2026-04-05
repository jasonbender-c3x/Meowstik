# 🐱 Database Migration Guide for Meowstik Custom Branding

> **Meowstik's on it!** - A comprehensive guide to migrating the database schema for custom branding support.

## Overview

This guide explains how to migrate the Meowstik database to support the new custom branding features, including:
- Single user branding configuration
- Multiple agent personas per user
- Custom names, signatures, and visual branding

## What Meowstik Needs to Do

Meowstik can manipulate databases! Here's what needs to happen:

### Phase 1: Understanding the Schema Changes

The migration adds two new tables to the database:

#### Table 1: `user_branding`
Stores default branding configuration for each user (one per user).

```sql
CREATE TABLE user_branding (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  
  -- Agent Identity
  agent_name VARCHAR NOT NULL DEFAULT 'Meowstik',
  display_name VARCHAR NOT NULL DEFAULT 'Meowstik AI',
  
  -- Visual Branding
  avatar_url TEXT,
  brand_color VARCHAR DEFAULT '#4285f4',
  
  -- Signatures
  github_signature TEXT,
  email_signature TEXT,
  
  -- Domain
  canonical_domain VARCHAR,
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

#### Table 2: `user_agents`
Stores multiple agent personas per user (unlimited).

```sql
CREATE TABLE user_agents (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Agent Identity
  name VARCHAR NOT NULL,
  display_name VARCHAR NOT NULL,
  description TEXT,
  agent_type VARCHAR NOT NULL DEFAULT 'assistant',
  
  -- Visual Branding
  avatar_url TEXT,
  brand_color VARCHAR DEFAULT '#4285f4',
  
  -- Personality & Behavior
  personality_prompt TEXT,
  system_prompt_overrides TEXT,
  
  -- Signatures
  github_signature TEXT,
  email_signature TEXT,
  
  -- Settings
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Metadata
  canonical_domain VARCHAR,
  tags TEXT[],
  
  -- Timestamps
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Phase 2: Pre-Migration Checklist

Before running the migration, Meowstik needs to verify:

1. **Database Connection** ✓
   ```bash
   # Check DATABASE_URL is set
   echo $DATABASE_URL
   
   # Should output something like:
   # postgresql://user:password@host:5432/meowstik
   ```

2. **Database Access** ✓
   ```bash
   # Test connection
   psql $DATABASE_URL -c "SELECT version();"
   ```

3. **Backup Current Database** ✓
   ```bash
   # Create backup before migration
   pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

4. **Check Existing Schema** ✓
   ```bash
   # List current tables
   psql $DATABASE_URL -c "\dt"
   ```

### Phase 3: Running the Migration

#### Option 1: Using Drizzle Kit (Recommended)

This is the **easiest** and **safest** method:

```bash
# 1. Install drizzle-kit if not already installed
npm install drizzle-kit --save-dev

# 2. Review the schema changes
npm run db:push -- --dry-run

# 3. Apply the migration
npm run db:push
```

**What happens:**
- Drizzle reads `shared/schema.ts`
- Compares it to current database state
- Generates SQL migration commands
- Applies changes to PostgreSQL
- Creates both new tables
- Sets up foreign keys and constraints

**Expected Output:**
```
✓ Executing SQL statements...
✓ Created table user_branding
✓ Created table user_agents
✓ Migration complete!
```

#### Option 2: Manual SQL Migration

If you need to run SQL directly:

```bash
# Connect to database
psql $DATABASE_URL

# Run the SQL
CREATE TABLE IF NOT EXISTS user_branding (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  agent_name VARCHAR NOT NULL DEFAULT 'Meowstik',
  display_name VARCHAR NOT NULL DEFAULT 'Meowstik AI',
  avatar_url TEXT,
  brand_color VARCHAR DEFAULT '#4285f4',
  github_signature TEXT,
  email_signature TEXT,
  canonical_domain VARCHAR,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_agents (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  display_name VARCHAR NOT NULL,
  description TEXT,
  agent_type VARCHAR NOT NULL DEFAULT 'assistant',
  avatar_url TEXT,
  brand_color VARCHAR DEFAULT '#4285f4',
  personality_prompt TEXT,
  system_prompt_overrides TEXT,
  github_signature TEXT,
  email_signature TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  canonical_domain VARCHAR,
  tags TEXT[],
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_user_branding_user_id ON user_branding(user_id);
CREATE INDEX idx_user_agents_user_id ON user_agents(user_id);
CREATE INDEX idx_user_agents_default ON user_agents(user_id, is_default) WHERE is_default = true;
CREATE INDEX idx_user_agents_active ON user_agents(user_id, is_active) WHERE is_active = true;
```

### Phase 4: Verify Migration Success

After migration, verify everything worked:

```bash
# 1. Check tables exist
psql $DATABASE_URL -c "\dt user_branding"
psql $DATABASE_URL -c "\dt user_agents"

# 2. Check table structure
psql $DATABASE_URL -c "\d user_branding"
psql $DATABASE_URL -c "\d user_agents"

# 3. Verify foreign keys
psql $DATABASE_URL -c "SELECT conname, conrelid::regclass, confrelid::regclass 
  FROM pg_constraint 
  WHERE conname LIKE '%user_branding%' OR conname LIKE '%user_agents%';"

# 4. Test insert (optional)
psql $DATABASE_URL -c "
  INSERT INTO user_branding (user_id, agent_name, display_name)
  VALUES ('test-user-id', 'Catpilot', 'Catpilot Pro')
  ON CONFLICT (user_id) DO NOTHING;
"

# 5. Verify insert
psql $DATABASE_URL -c "SELECT * FROM user_branding LIMIT 1;"
```

### Phase 5: Post-Migration Testing

Test the API endpoints to ensure everything works:

```bash
# 1. Test branding endpoint
curl http://localhost:5000/api/branding

# Expected: Returns default branding or 401 if not authenticated

# 2. Test user-agents endpoint
curl http://localhost:5000/api/user-agents

# Expected: Returns empty array or 401 if not authenticated

# 3. Create a test agent (requires authentication)
curl -X POST http://localhost:5000/api/user-agents \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Catpilot",
    "displayName": "Catpilot Pro",
    "agentType": "assistant",
    "brandColor": "#FF6B35"
  }'
```

## Troubleshooting

### Problem: "DATABASE_URL not set"

**Solution:**
```bash
# Copy .env.example to .env
cp .env.example .env

# Edit .env and set DATABASE_URL
# Format: postgresql://username:password@host:port/database
```

### Problem: "drizzle-kit: command not found"

**Solution:**
```bash
# Install drizzle-kit
npm install drizzle-kit --save-dev

# Verify installation
npx drizzle-kit --version
```

### Problem: "relation 'users' does not exist"

**Solution:**
The `users` table needs to exist first. Run initial migrations:
```bash
# Check if users table exists
psql $DATABASE_URL -c "\d users"

# If not, you need to run the base schema migration first
npm run db:push
```

### Problem: "permission denied for table users"

**Solution:**
Database user needs proper permissions:
```sql
GRANT ALL PRIVILEGES ON TABLE users TO your_database_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO your_database_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO your_database_user;
```

### Problem: Migration fails halfway

**Solution:**
Restore from backup and try again:
```bash
# Drop the new tables if they exist
psql $DATABASE_URL -c "DROP TABLE IF EXISTS user_agents CASCADE;"
psql $DATABASE_URL -c "DROP TABLE IF EXISTS user_branding CASCADE;"

# Restore from backup
psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql

# Try migration again with --verbose
npm run db:push -- --verbose
```

## Migration Rollback

If you need to undo the migration:

```sql
-- Drop tables (CASCADE removes foreign key dependencies)
DROP TABLE IF EXISTS user_agents CASCADE;
DROP TABLE IF EXISTS user_branding CASCADE;
```

To restore from backup:
```bash
psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql
```

## Configuration Files

### drizzle.config.ts

The migration configuration is in `drizzle.config.ts`:

```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './shared/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
```

### shared/schema.ts

The schema definitions are in `shared/schema.ts` with:
- Table definitions using Drizzle ORM syntax
- TypeScript types for type safety
- Zod schemas for validation
- Default values and constraints

## Best Practices

1. **Always backup before migration** ✅
2. **Test in development first** ✅
3. **Review SQL in dry-run mode** ✅
4. **Verify foreign keys after migration** ✅
5. **Test API endpoints post-migration** ✅
6. **Keep backup for 30 days** ✅

## Quick Reference

```bash
# Complete Migration Workflow
# 1. Backup
pg_dump $DATABASE_URL > backup.sql

# 2. Review changes
npm run db:push -- --dry-run

# 3. Apply migration
npm run db:push

# 4. Verify
psql $DATABASE_URL -c "\dt user_*"

# 5. Test
curl http://localhost:5000/api/branding
curl http://localhost:5000/api/user-agents
```

## Common Commands Reference

```bash
# Database Connection
psql $DATABASE_URL                          # Connect to database
psql $DATABASE_URL -c "SQL COMMAND"         # Run single command

# Schema Inspection
\dt                                         # List tables
\d table_name                              # Describe table
\di                                         # List indexes
\df                                         # List functions

# Migration Commands
npm run db:push                            # Apply migration
npm run db:push -- --dry-run               # Preview changes
npm run db:push -- --verbose               # Detailed output

# Backup & Restore
pg_dump $DATABASE_URL > backup.sql         # Create backup
psql $DATABASE_URL < backup.sql            # Restore backup
```

## What Changed in the Codebase

Files modified for database support:

1. **`shared/schema.ts`**
   - Added `userBranding` table definition
   - Added `userAgents` table definition
   - Added TypeScript types
   - Added Zod validation schemas
   - Added default constants

2. **`server/storage.ts`**
   - Added CRUD methods for `user_branding`
   - Added CRUD methods for `user_agents`
   - Added helper methods with defaults

3. **`server/routes/branding.ts`** (NEW)
   - API endpoints for branding management

4. **`server/routes/user-agents.ts`** (NEW)
   - API endpoints for agent management

5. **`drizzle.config.ts`**
   - Already configured (no changes needed)

## Summary

**Meowstik's Migration Checklist:**

- [ ] Verify DATABASE_URL is set
- [ ] Backup current database
- [ ] Install drizzle-kit (if needed)
- [ ] Run `npm run db:push`
- [ ] Verify tables created
- [ ] Test API endpoints
- [ ] Celebrate! 🎉 **Meowstik's on it!**

---

**Need Help?**
- Check logs: Server console output
- Check database: `psql $DATABASE_URL -c "\dt"`
- Check schema: `\d user_branding` and `\d user_agents`
- Ask Meowstik! (That's you! 🐱)

**Remember:** Meowstik can manipulate databases - and now you can too! 🚀
