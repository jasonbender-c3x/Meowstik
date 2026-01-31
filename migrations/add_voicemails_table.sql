-- Add voicemails table for Twilio voicemail support
-- Generated: 2026-01-31

CREATE TABLE IF NOT EXISTS "voicemails" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "recording_sid" text UNIQUE NOT NULL,
  "call_sid" text,
  "from_number" text NOT NULL,
  "to_number" text NOT NULL,
  "recording_url" text NOT NULL,
  "duration" integer,
  "transcription" text,
  "transcription_status" text,
  "heard" boolean DEFAULT false NOT NULL,
  "heard_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS "idx_voicemails_recording_sid" ON "voicemails" ("recording_sid");
CREATE INDEX IF NOT EXISTS "idx_voicemails_from_number" ON "voicemails" ("from_number");
CREATE INDEX IF NOT EXISTS "idx_voicemails_heard" ON "voicemails" ("heard");
