-- Add recording and transcription fields to call_conversations table
-- Generated: 2026-01-31

-- Add new columns for call recording and transcription
ALTER TABLE call_conversations 
  ADD COLUMN IF NOT EXISTS recording_url text,
  ADD COLUMN IF NOT EXISTS recording_sid text,
  ADD COLUMN IF NOT EXISTS transcription text,
  ADD COLUMN IF NOT EXISTS transcription_status text;

-- Create index for recording SID lookups
CREATE INDEX IF NOT EXISTS idx_call_conversations_recording_sid ON call_conversations (recording_sid);

-- Add comments for documentation
COMMENT ON COLUMN call_conversations.recording_url IS 'URL to the full call recording from Twilio';
COMMENT ON COLUMN call_conversations.recording_sid IS 'Twilio recording identifier for this call';
COMMENT ON COLUMN call_conversations.transcription IS 'Full transcription of the call from Twilio';
COMMENT ON COLUMN call_conversations.transcription_status IS 'Status of transcription: pending, completed, or failed';
