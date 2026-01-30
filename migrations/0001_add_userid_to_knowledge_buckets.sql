-- Migration: Add userId columns to evidence and knowledgeEmbeddings tables for data isolation
-- Date: 2026-01-15
-- Purpose: Fix critical security vulnerability where knowledge buckets didn't filter by user
-- Related Issue: RAG Knowledge Bucket Implementation Audit

-- Add userId and isGuest columns to evidence table
-- Note: userId can be NULL for guest users, foreign key uses ON DELETE SET NULL
ALTER TABLE evidence 
ADD COLUMN IF NOT EXISTS user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT FALSE;

-- Add userId and isGuest columns to knowledgeEmbeddings table  
-- Note: userId can be NULL for guest users, foreign key uses ON DELETE SET NULL
ALTER TABLE knowledge_embeddings
ADD COLUMN IF NOT EXISTS user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT FALSE;

-- Create indexes for efficient filtering by userId
CREATE INDEX IF NOT EXISTS idx_evidence_user_id ON evidence(user_id);
CREATE INDEX IF NOT EXISTS idx_evidence_bucket_user ON evidence(bucket, user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_user_id ON knowledge_embeddings(user_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_bucket_user ON knowledge_embeddings(bucket, user_id);

-- For existing data without userId, set them as guest data
-- This ensures backward compatibility
UPDATE evidence SET is_guest = TRUE WHERE user_id IS NULL;
UPDATE knowledge_embeddings SET is_guest = TRUE WHERE user_id IS NULL;

-- Add comments to document the purpose of these columns
COMMENT ON COLUMN evidence.user_id IS 'User ID for data isolation - NULL for guest users. Foreign key uses ON DELETE SET NULL to preserve guest data.';
COMMENT ON COLUMN evidence.is_guest IS 'Flag indicating whether this is guest data (should be periodically cleaned)';
COMMENT ON COLUMN knowledge_embeddings.user_id IS 'User ID for data isolation - NULL for guest users. Foreign key uses ON DELETE SET NULL to preserve guest data.';
COMMENT ON COLUMN knowledge_embeddings.is_guest IS 'Flag indicating whether this is guest data (should be periodically cleaned)';
