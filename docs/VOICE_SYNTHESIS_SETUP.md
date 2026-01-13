# Voice Synthesis Setup Guide

## Overview

Meowstik uses Google Cloud Text-to-Speech API for high-quality voice synthesis. This provides superior audio quality compared to browser-based TTS, with support for multiple neural voices and up to 1M characters/month on the free tier.

## Authentication Methods

The TTS system supports two authentication methods:

### 1. Service Account (Recommended for Production)

Service accounts provide consistent, application-level authentication without requiring user login.

**Setup:**

1. **Get Service Account JSON Key**
   - The service account key file should be placed in `attached_assets/` directory
   - Example filename: `service-account-key.json`

2. **Configure Environment Variable**
   - Set `GOOGLE_APPLICATION_CREDENTIALS` to point to your service account JSON file
   - For Replit: Configure in `.replit` file or Secrets panel
   - For local development: Add to `.env` file:
     ```bash
     GOOGLE_APPLICATION_CREDENTIALS=attached_assets/service-account-key.json
     ```

3. **Verify Service Account Permissions**
   - The service account must have the **Cloud Text-to-Speech API** enabled
   - Required scope: `https://www.googleapis.com/auth/cloud-platform`

### 2. OAuth2 (Fallback)

If no service account is configured, the system falls back to using the user's OAuth2 tokens.

**Requirements:**
- User must be authenticated via Google OAuth
- OAuth scope must include: `https://www.googleapis.com/auth/cloud-platform`

**Note:** This is already included in the SCOPES array in `server/integrations/google-auth.ts`

## Available Voices

The system provides 8 high-quality neural voices:

| Voice Name | Gender | Voice ID |
|------------|--------|----------|
| Kore | Female | en-US-Neural2-C |
| Puck | Male | en-US-Neural2-D |
| Charon | Male | en-US-Neural2-A |
| Fenrir | Male | en-US-Neural2-J |
| Aoede | Female | en-US-Neural2-E |
| Leda | Female | en-US-Neural2-F |
| Orus | Male | en-US-Neural2-I |
| Zephyr | Female | en-US-Neural2-H |

## API Endpoints

### Generate Speech
```
POST /api/speech/tts
Content-Type: application/json

{
  "text": "Hello, this is a test message",
  "speakers": [
    { "voice": "Kore" }
  ],
  "model": "flash"
}
```

**Response:**
```json
{
  "success": true,
  "audioBase64": "base64_encoded_audio_data",
  "mimeType": "audio/mpeg",
  "duration": 5
}
```

### Get Available Voices
```
GET /api/speech/voices
```

**Response:**
```json
{
  "voices": ["Kore", "Puck", "Charon", "Fenrir", "Aoede", "Leda", "Orus", "Zephyr"]
}
```

## Troubleshooting

### Authentication Issues

**Symptom:** "Google authentication not available" error

**Solutions:**
1. Verify `GOOGLE_APPLICATION_CREDENTIALS` environment variable is set
2. Check that the service account JSON file exists and is readable
3. Ensure the file path is correct (relative or absolute)
4. For Replit: Check Secrets panel for the environment variable

**Symptom:** "Permission denied" or "PERMISSION_DENIED" error

**Solutions:**
1. Enable Text-to-Speech API in Google Cloud Console:
   - Go to https://console.cloud.google.com/apis/library/texttospeech.googleapis.com
   - Select your project (ai-stack-e2a5f)
   - Click "Enable"
2. Verify service account has proper IAM roles:
   - Role needed: "Cloud Text-to-Speech User" or "Editor"
3. For OAuth: Re-authorize your Google account to include cloud-platform scope

### Rate Limiting

**Free Tier Limits:**
- 1 million characters per month
- Standard voices: $4.00 per 1M characters after free tier
- Neural2 voices: $16.00 per 1M characters after free tier

**Solutions:**
- Monitor usage in Google Cloud Console
- Implement caching for frequently used phrases
- Use browser TTS as fallback for non-critical audio

### Audio Not Playing

**Symptom:** Audio data returned but no sound plays

**Solutions:**
1. Check browser autoplay policies - user interaction may be required first
2. Verify audio format support (MP3 should work in all modern browsers)
3. Check browser console for errors
4. Ensure audio elements are properly unmuted

## Code Architecture

### Implementation Files

- **`server/integrations/expressive-tts.ts`**: Core TTS implementation
  - `generateSingleSpeakerAudio()`: Main synthesis function
  - `generateMultiSpeakerAudio()`: Multi-voice wrapper (currently uses single voice)
  - `getAvailableVoices()`: Returns list of available voices

- **`server/integrations/google-auth.ts`**: Google OAuth2 management
  - Handles both service account and OAuth2 authentication
  - Automatic token refresh
  - Database persistence

- **`server/routes/speech.ts`**: API endpoint handlers
  - `/api/speech/tts`: Generate speech
  - `/api/speech/voices`: List voices
  - `/api/speech/transcribe`: Speech-to-text (separate feature)

- **`client/src/contexts/tts-context.tsx`**: Frontend TTS context
  - Manages verbosity modes (mute/quiet/verbose/experimental)
  - Browser TTS fallback
  - Audio playback control

## Testing

### Manual Test

1. Start the development server:
   ```bash
   npm run dev
   ```

2. Test authentication:
   ```bash
   curl http://localhost:5000/api/speech/voices
   ```

3. Test voice synthesis:
   ```bash
   curl -X POST http://localhost:5000/api/speech/tts \
     -H "Content-Type: application/json" \
     -d '{
       "text": "Hello from Meowstik!",
       "speakers": [{"voice": "Kore"}]
     }'
   ```

### Expected Behavior

- Service account authentication should load on server startup
- Logs should show: `[TTS] Loaded service account credentials`
- First TTS request should show: `[TTS] Generating audio with Google Cloud TTS (service account), voice: en-US-Neural2-C`
- Response should include base64-encoded MP3 audio data

## Security Notes

1. **Never commit service account keys to git**
   - The `.gitignore` already excludes `attached_assets/*.json`
   - Keep service account files in `attached_assets/` directory

2. **Rotate keys regularly**
   - Generate new service account keys periodically
   - Revoke old keys after rotation

3. **Limit service account permissions**
   - Use principle of least privilege
   - Only grant Text-to-Speech permissions if that's all you need

## References

- [Google Cloud Text-to-Speech Documentation](https://cloud.google.com/text-to-speech/docs)
- [Service Account Authentication](https://cloud.google.com/docs/authentication/production)
- [Voice Selection Guide](https://cloud.google.com/text-to-speech/docs/voices)
