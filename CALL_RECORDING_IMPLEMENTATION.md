# Call Recording & Transcription Implementation

## Overview

All voice calls in Meowstik are now **automatically recorded and transcribed**. This applies to both inbound calls (when someone calls your Twilio number) and outbound calls (when you make calls using the system).

---

## Features

### Automatic Recording
- **Inbound calls**: Recording starts immediately when call connects
- **Outbound calls**: Recording starts when recipient answers
- **Full conversation**: Entire call is captured, including all speech turns
- **Secure storage**: Recording URLs stored in database

### Automatic Transcription
- **Speech-to-text**: Provided by Twilio's transcription service
- **Availability**: Typically ready within 1-2 minutes after call ends
- **Full text**: Complete transcription of entire call
- **Searchable**: Transcripts can be searched for keywords and context

---

## Technical Implementation

### Database Schema

Added to `call_conversations` table:
```sql
recording_url         text    -- URL to access the Twilio recording
recording_sid         text    -- Twilio recording identifier
transcription         text    -- Full call transcription text
transcription_status  text    -- Status: pending, completed, failed
```

### Webhook Endpoints

**Recording Completion**
- Endpoint: `POST /api/twilio/webhooks/call-recording`
- Triggered: When call recording finishes
- Action: Stores recording URL and SID in database
- Sets: `transcriptionStatus = 'pending'`

**Transcription Completion**
- Endpoint: `POST /api/twilio/webhooks/call-transcription`
- Triggered: When Twilio completes transcription (1-2 min after call)
- Action: Stores transcription text in database
- Updates: `transcriptionStatus = 'completed'` or `'failed'`

### Call Configuration

All calls are created with these Twilio parameters:
```javascript
{
  record: true,
  recordingStatusCallback: '/api/twilio/webhooks/call-recording',
  transcribe: true,
  transcribeCallback: '/api/twilio/webhooks/call-transcription',
  maxLength: 3600  // 1 hour maximum
}
```

---

## How It Works

### Inbound Call Flow

```
1. User calls Twilio number
   ↓
2. /webhooks/voice endpoint triggered
   - Creates call_conversations record
   - Enables recording and transcription
   - Responds with TwiML (greeting + gather)
   ↓
3. Call proceeds normally
   - All audio captured
   - Speech-to-text for interactive responses
   ↓
4. Call ends
   ↓
5. /webhooks/call-recording triggered
   - Twilio sends RecordingSid, RecordingUrl, Duration
   - Database updated with recording details
   - Status set to 'pending' for transcription
   ↓
6. (1-2 minutes later) /webhooks/call-transcription triggered
   - Twilio sends full transcription text
   - Database updated with transcription
   - Status set to 'completed'
```

### Outbound Call Flow

```
1. System calls call_make tool
   ↓
2. makeCall() or makeCallWithMessage() invoked
   - Recording enabled by default
   - Transcription callbacks configured
   ↓
3. Twilio initiates call
   ↓
4. Same webhook flow as inbound calls (steps 4-6 above)
```

---

## Storage Methods

### New Methods Added

```typescript
// Update call by Twilio call SID
updateCallConversationBySid(callSid: string, updates: Partial<InsertCallConversation>)

// Lookup call by recording SID
getCallConversationByRecordingSid(recordingSid: string)
```

### Usage Examples

```typescript
// Save recording details when recording completes
await storage.updateCallConversationBySid(CallSid, {
  recordingUrl: RecordingUrl,
  recordingSid: RecordingSid,
  duration: parseInt(RecordingDuration),
  transcriptionStatus: 'pending',
});

// Save transcription when ready
const conversation = await storage.getCallConversationByRecordingSid(RecordingSid);
await storage.updateCallConversation(conversation.id, {
  transcription: TranscriptionText,
  transcriptionStatus: 'completed',
});
```

---

## LLM Integration

### System Prompts Updated

**`prompts/tools.md`**
- Added detailed documentation for call tools
- Explained automatic recording and transcription
- Listed new call tools: `call_get`, `call_search`
- Described transcription availability timeline

**`prompts/core-directives.md`**
- Added "Voice Call Capabilities" section
- Explained automatic recording for all calls
- Provided usage examples for accessing call data
- Best practices for using call history and transcriptions

### LLM Capabilities

The LLM can now:
1. **Access call history**: Use `call_list` to see recent calls with transcriptions
2. **Get call details**: Use `call_get` to retrieve specific call info
3. **Search transcriptions**: Use `call_search` to find keywords in past calls
4. **Context awareness**: Reference previous calls for follow-up conversations
5. **Documentation**: Use transcripts for record-keeping and analysis

---

## Configuration

### Twilio Console Setup

**For Call Recording Webhook:**
1. Go to Twilio Console → Phone Numbers → Active Numbers
2. Select your Twilio number
3. Under "Voice Configuration":
   - Recording Status Callback: `https://your-domain.com/api/twilio/webhooks/call-recording`
   - Method: POST

**For Call Transcription Webhook:**
- This is configured programmatically via the `transcribeCallback` parameter
- No additional console configuration needed

### Environment Variables

Required:
```env
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+15551234567
BASE_URL=https://your-domain.com  # For webhook callbacks
DATABASE_URL=postgresql://...
```

---

## Database Migration

To add the new fields to existing database:

**Option 1: Automatic (Drizzle)**
- Schema changes will be applied on next server start
- No manual action required

**Option 2: Manual SQL**
```bash
psql $DATABASE_URL -f migrations/add_call_recording_transcription.sql
```

Migration adds:
- 4 new columns to `call_conversations` table
- 1 new index on `recording_sid`
- Column comments for documentation

---

## Testing

### Test Recording

1. **Make a test call:**
   ```bash
   curl -X POST http://localhost:5000/api/communications/calls \
     -H "Content-Type: application/json" \
     -d '{"to": "+15551234567", "message": "This is a test call"}'
   ```

2. **Check recording was saved:**
   ```bash
   curl http://localhost:5000/api/communications/calls
   # Look for recordingUrl field
   ```

3. **Wait 1-2 minutes for transcription**

4. **Check transcription:**
   ```bash
   curl http://localhost:5000/api/communications/calls
   # Look for transcription field
   ```

### Test Inbound Call

1. Call your Twilio number
2. Have a conversation with the AI
3. Check database for call record:
   ```sql
   SELECT call_sid, recording_url, transcription_status, transcription 
   FROM call_conversations 
   ORDER BY created_at DESC 
   LIMIT 1;
   ```

---

## Monitoring

### Log Messages

**Recording Saved:**
```
[Twilio Call] Recording completed for call CAxxxx: RExxxx
[Twilio Call] Recording URL saved: https://api.twilio.com/...
```

**Transcription Received:**
```
[Twilio Call] Transcription received for call CAxxxx: RExxxx
[Twilio Call] Transcription updated for call CAxxxx
```

### Database Checks

**View recent calls with recordings:**
```sql
SELECT 
  call_sid,
  from_number,
  to_number,
  duration,
  recording_url,
  transcription_status,
  LEFT(transcription, 100) as transcription_preview,
  created_at
FROM call_conversations
WHERE recording_url IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;
```

**Check transcription status:**
```sql
SELECT 
  transcription_status,
  COUNT(*) as count
FROM call_conversations
GROUP BY transcription_status;
```

---

## Costs

### Twilio Pricing (Approximate)

- **Voice minutes**: ~$0.0085/minute
- **Recording storage**: ~$0.0025/minute/month
- **Transcription**: ~$0.05/minute

**Example:**
- 10-minute call costs approximately:
  - Voice: $0.085
  - Recording: $0.025/month storage
  - Transcription: $0.50
  - **Total**: ~$0.61 per call + storage

---

## Troubleshooting

### Recording Not Saved

**Problem**: Call completes but no recording URL in database

**Solutions:**
1. Check webhook URL is accessible from Twilio
2. Verify `BASE_URL` environment variable is set correctly
3. Check Twilio webhook logs in Console
4. Ensure recording callback endpoint is `/api/twilio/webhooks/call-recording`

### Transcription Never Completes

**Problem**: `transcriptionStatus` stuck on 'pending'

**Solutions:**
1. Wait 5 minutes (Twilio transcription can be slow)
2. Check Twilio Console for transcription status
3. Verify transcription callback URL is correct
4. Check server logs for webhook errors

### Empty Transcription

**Problem**: `transcription` field is empty or null

**Possible Causes:**
1. Call had no speech (silence)
2. Audio quality too poor for transcription
3. Twilio transcription service failed
4. Transcription webhook not triggered

---

## Future Enhancements

### Potential Improvements

1. **Real-time Transcription**: Use Twilio Media Streams for live transcription
2. **Speaker Diarization**: Identify different speakers in conversation
3. **Sentiment Analysis**: Analyze tone and sentiment from transcripts
4. **Call Analytics**: Generate insights from call patterns
5. **Custom TTS Integration**: Use Google Cloud TTS for better voice quality
6. **Recording Cleanup**: Automatic deletion of old recordings (GDPR compliance)

---

## Summary

✅ **All calls automatically recorded**  
✅ **All calls automatically transcribed**  
✅ **Recording URLs stored in database**  
✅ **Transcriptions searchable**  
✅ **LLM aware of capabilities**  
✅ **Webhook handlers implemented**  
✅ **Storage methods added**  
✅ **System prompts updated**  

Every voice call in Meowstik now has complete recording and transcription support, making all conversations searchable, analyzable, and retrievable for future context.
