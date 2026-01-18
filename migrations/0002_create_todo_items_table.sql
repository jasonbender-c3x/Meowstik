-- Migration: Create todo_items table for persistent to-do list
-- Author: GitHub Copilot
-- Date: 2026-01-18

-- Create todo_items table
CREATE TABLE IF NOT EXISTS "todo_items" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "status" text NOT NULL DEFAULT 'pending',
  "priority" integer NOT NULL DEFAULT 0,
  "category" text,
  "tags" text[],
  "related_chat_id" varchar,
  "created_at" timestamp NOT NULL DEFAULT now(),
  "updated_at" timestamp NOT NULL DEFAULT now(),
  "completed_at" timestamp,
  
  -- Foreign key constraints
  CONSTRAINT "todo_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "todo_items_related_chat_id_chats_id_fk" FOREIGN KEY ("related_chat_id") REFERENCES "chats"("id") ON DELETE SET NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_todo_items_user" ON "todo_items" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_todo_items_status" ON "todo_items" ("status");
CREATE INDEX IF NOT EXISTS "idx_todo_items_priority" ON "todo_items" ("priority");

-- Add comment to table
COMMENT ON TABLE "todo_items" IS 'Persistent to-do list items for users. Included in every prompt to inform AI decision-making.';
