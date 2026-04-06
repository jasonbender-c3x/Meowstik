# Interactive Conversational Calling via Twilio

This document describes the implementation of real-time, two-way conversational calling using Twilio's Voice API with AI-powered responses from Google Gemini.

## Overview

The Meowstik AI assistant can now handle phone calls with natural conversation. Users can call a Twilio phone number, speak their questions, and receive AI-generated spoken responses in real-time. The system maintains conversation context across multiple turns, creating a seamless phone experience.

## Features

### Phase 1: Basic Speech Capture (✅ Implemented)

- **Multi-turn Conversations**: The system continuously captures and processes user speech until the conversation ends
- **Speech-to-Text**: Twilio's enhanced speech recognition converts spoken words to text
- **AI Response Generation**: Google Gemini 2.0 Flash generates contextual responses
- **Text-to-Speech**: Twilio's Amazon Polly voices speak the AI's responses
- **Conversation Tracking**: All calls are logged with complete turn history in the database
- **Natural Termination**: Users can end calls by saying goodbye, thank you, or similar phrases

### Phase 2: Advanced Conversational Flow (🔄 Planned)

- Persistent conversation context across sessions
- Dynamic TwiML generation for complex branching
- Enhanced context retrieval from conversation history

### Phase 3: Enhanced Speech AI (🔮 Future)

- Sentiment analysis integration
- Barge-in support (user can interrupt the AI)
- Real-time streaming with WebSocket Media Streams

## Architecture

### Database Schema

#### `call_conversations` Table
Stores metadata for each phone call:
- `call_sid`: Twilio's unique call identifier
- `from_number`: Caller's phone number
- `to_number`: Receiving number (your Twilio number)
- `chat_id`: Links to a chat session for full message history
- `status`: Call status (in_progress, completed, failed, no_input)
- `turn_count`: Number of speech turns in the conversation
- `duration`: Call duration in seconds

#### `call_turns` Table
Stores individual speech exchanges:
- `conversation_id`: Links to parent call conversation
- `turn_number`: Sequential turn number
- `user_speech`: Transcribed user speech from Twilio
- `speech_confidence`: Twilio's confidence score (0.0-1.0)
- `ai_response`: AI-generated response text
- `ai_response_audio`: TwiML or audio URL (if custom TTS)

### Request Flow

```
┌──────────────┐
│  User Calls  │
│ Twilio Number│
└──────┬───────┘
       │
       ▼
┌─────────────────────────────────────────┐
│  /webhook/voice                         │
│  - Create call conversation & chat      │
│  - Speak greeting via <Say>             │
│  - Start <Gather> for speech input      │
└──────┬──────────────────────────────────┘
       │
       │ (User speaks)
       │
       ▼
┌─────────────────────────────────────────┐
│  /webhook/speech-result                 │
│  - Receive transcribed speech           │
│  - Save user message                    │
│  - Generate AI response (Gemini)        │
│  - Save AI message                      │
│  - Create call turn record              │
│  - Return TwiML with <Say> + <Gather>  │
└──────┬──────────────────────────────────┘
       │
       │ (Loop continues)
       │
       ▼
┌─────────────────────────────────────────┐
│  User says "goodbye"                    │
│  - AI responds with farewell            │
│  - Call ends with <Hangup>              │
│  - Update conversation status           │
└─────────────────────────────────────────┘
```

## Setup Instructions

### 1. Configure Environment Variables

Add these to your `.env` file:

```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+15551234567

# Google Gemini API (required for AI responses)
GEMINI_API_KEY=your_gemini_api_key
```

### 2. Configure Twilio Webhooks

1. Log in to [Twilio Console](https://console.twilio.com/)
2. Go to **Phone Numbers** → **Manage** → **Active numbers**
3. Click on your Twilio phone number
4. Under **Voice Configuration**:
   - **A CALL COMES IN**: Webhook
   - URL: `https://your-domain.com/api/twilio/webhook/voice`
   - Method: `HTTP POST`
5. Under **Status Callback URL**:
   - URL: `https://your-domain.com/api/twilio/webhook/status`
   - Method: `HTTP POST`
6. Save configuration

### 3. Deploy Your Application

Ensure your Meowstik server is publicly accessible (required for Twilio webhooks):

```bash
# Development (use ngrok for local testing)
ngrok http 5000

# Production
npm run build
npm start
```

### 4. Test the System

1. Call your Twilio phone number
2. Listen for the greeting: "Hello! Welcome to Meowstik AI..."
3. Speak your question or request
4. Listen to the AI's response
5. Continue the conversation or say "goodbye" to end

## API Endpoints

### Call Management

#### `GET /api/twilio/conversations`
List recent call conversations

**Query Parameters:**
- `limit` (optional): Maximum number of conversations to return (default: 20)

**Response:**
```json
[
  {
    "id": "conv-uuid",
    "callSid": "CAxxxxxxxx",
    "fromNumber": "+15551234567",
    "toNumber": "+15559876543",
    "chatId": "chat-uuid",
    "status": "completed",
    "turnCount": 5,
    "startedAt": "2024-01-01T12:00:00Z",
    "endedAt": "2024-01-01T12:03:30Z",
    "duration": 210
  }
]
```

#### `GET /api/twilio/conversations/:id`
Get specific conversation with full turn history

**Response:**
```json
{
  "conversation": { /* conversation object */ },
  "turns": [
    {
      "id": "turn-uuid",
      "conversationId": "conv-uuid",
      "turnNumber": 1,
      "userSpeech": "What's the weather like today?",
      "speechConfidence": "0.95",
      "aiResponse": "I can help you with that! However, I need your location...",
      "createdAt": "2024-01-01T12:00:30Z"
    }
  ],
  "chat": { /* associated chat object */ }
}
```

### Twilio Webhooks (Called by Twilio)

#### `POST /api/twilio/webhook/voice`
Handles incoming calls - creates conversation and starts speech gathering

#### `POST /api/twilio/webhook/speech-result`
Processes transcribed speech and generates AI responses

#### `POST /api/twilio/webhook/status`
Receives call status updates (completed, failed, etc.)

## How It Works

### Speech Recognition

The system uses Twilio's enhanced speech recognition with:
- **Model**: `phone_call` (optimized for telephone audio)
- **Timeout**: `auto` (detects when user stops speaking)
- **Language**: `en-US` (configurable)
- **Hints**: Contextual keywords to improve accuracy

### AI Response Generation

Responses are generated using Google Gemini 2.0 Flash with:
- **System Prompt**: Instructs the AI to be conversational and concise
- **Context Window**: Last 10 messages from conversation history
- **Rules**: Keep responses 2-3 sentences, speak naturally, ask follow-ups
- **Termination Detection**: Recognizes goodbye phrases to end calls

### Text-to-Speech

TwiML's `<Say>` verb uses:
- **Voice**: `Polly.Joanna` (Amazon Polly female voice)
- **Language**: `en-US`
- **Quality**: High-quality neural voice synthesis

## Conversation Examples

### Simple Q&A
```
User: "What time is it?"
AI: "I can tell you the current time! It's 3:45 PM. Is there anything else you'd like to know?"
User: "No, that's all. Thank you."
AI: "Thank you for calling Meowstik AI. Have a great day! Goodbye."
[Call ends]
```

### Multi-turn Conversation
```
User: "Can you help me with my schedule?"
AI: "Of course! I'd be happy to help with your schedule. What would you like to know or do?"
User: "What meetings do I have today?"
AI: "Let me check your calendar. It looks like you have three meetings today. Your first meeting is at 10 AM. Would you like details about all of them?"
User: "Yes, please."
AI: "Sure! You have: 10 AM - Team standup, 2 PM - Client presentation, and 4 PM - Project review. Is there anything else I can help you with?"
User: "No, thank you. Goodbye."
AI: "Thank you for calling. Have a productive day! Goodbye."
[Call ends]
```

## Monitoring and Debugging

### View Call Logs

```bash
# List recent conversations
curl https://your-domain.com/api/twilio/conversations

# Get specific conversation with turns
curl https://your-domain.com/api/twilio/conversations/{conversation-id}
```

### Twilio Debugger

Monitor real-time webhook requests in the [Twilio Debugger](https://console.twilio.com/us1/monitor/logs/debugger):
- View all webhook calls
- Check request/response payloads
- Debug TwiML validation errors

### Server Logs

Key log messages to watch for:
```
[Twilio Voice] Incoming call from +15551234567, SID: CAxxxxxxxx
[Twilio Voice] Creating new conversation for call CAxxxxxxxx
[Twilio Speech] Received speech for conversation conv-uuid
[Twilio Speech] Transcribed: "Hello, can you help me?" (confidence: 0.95)
[Twilio Speech] Generating AI response with 2 context messages
[Twilio Speech] AI response: "Hello! I'd be happy to help you..."
[Twilio Speech] Call ended, duration: 120s
```

## Limitations and Known Issues

### Current Limitations

1. **Language Support**: Currently English (en-US) only
2. **Voice Selection**: Fixed to Polly.Joanna voice
3. **Context Window**: Limited to last 10 messages
4. **No Barge-in**: Users must wait for AI to finish speaking
5. **No Sentiment Analysis**: Not yet implemented

### Potential Issues

1. **Low Speech Confidence**: If Twilio's confidence score is low, responses may be based on incorrect transcription
2. **Network Latency**: Response time depends on Gemini API latency (typically 1-2 seconds)
3. **Cost**: Each call incurs Twilio charges (voice minutes + speech recognition)

## Cost Considerations

### Twilio Costs (per call)
- Voice minutes: ~$0.0085/minute
- Speech recognition: ~$0.02 per request
- Text-to-speech (Say): Included with voice minutes

### Gemini API Costs
- Gemini 2.0 Flash: Very low cost per request
- Token usage: ~100-500 tokens per turn (input + output)

**Estimated cost per 3-minute call**: ~$0.10 - $0.15

## Future Enhancements

### Phase 2: Advanced Conversational Flow

1. **Persistent Context**: Store conversation summaries for multi-session context
2. **Dynamic TwiML**: Generate complex conversation flows with branching
3. **Tool Integration**: Allow AI to check calendars, send emails, etc. during calls
4. **Multilingual Support**: Add support for Spanish, French, etc.

### Phase 3: Enhanced Speech AI

1. **Sentiment Analysis**: Detect caller emotion and adjust response tone
2. **Barge-in Support**: Allow users to interrupt the AI
3. **Real-time Streaming**: Use Twilio Media Streams for lower latency
4. **Custom TTS**: Use Google Cloud TTS for more voice options
5. **Conversation Analytics**: Track common questions, satisfaction scores

## Troubleshooting

### "I didn't hear anything. Goodbye!"

**Cause**: User didn't speak within the timeout period

**Solution**: Increase `speechTimeout` in the `<Gather>` verb or prompt user more clearly

### "I'm sorry, there was an error..."

**Cause**: Server error processing the request

**Solution**: Check server logs for stack traces. Common issues:
- Gemini API key not configured
- Database connection failed
- Twilio credentials invalid

### Calls not reaching webhook

**Cause**: Webhook URL not configured or unreachable

**Solution**:
1. Verify webhook URL in Twilio console
2. Ensure server is publicly accessible
3. Check Twilio Debugger for failed webhook attempts
4. Test webhook with `curl` from command line

### Poor speech recognition accuracy

**Cause**: Background noise, unclear speech, or incorrect language setting

**Solution**:
- Add more `hints` to the `<Gather>` configuration
- Prompt user to speak clearly
- Consider using `enhanced: true` (already enabled)
- Check caller's phone audio quality

## Security Considerations

### Webhook Validation

The current implementation does not validate Twilio webhook signatures. For production:

1. Enable signature validation in `server/integrations/twilio.ts`
2. Use `validateWebhookSignature()` function in webhook routes
3. Reject requests with invalid signatures

Example:
```typescript
const signature = req.headers['x-twilio-signature'];
const url = `https://your-domain.com${req.originalUrl}`;
const valid = twilioIntegration.validateWebhookSignature(signature, url, req.body);

if (!valid) {
  return res.status(403).send('Invalid signature');
}
```

### Data Privacy

- Call transcripts are stored in the database
- Consider implementing data retention policies
- Add GDPR-compliant user consent mechanisms
- Encrypt sensitive phone numbers in database

## Support

For issues or questions:
- Check server logs for error details
- Review Twilio Debugger for webhook issues
- Consult Twilio's [Voice API documentation](https://www.twilio.com/docs/voice)
- Review Gemini API [documentation](https://ai.google.dev/docs)

## References

- [Twilio Voice API](https://www.twilio.com/docs/voice)
- [TwiML Voice](https://www.twilio.com/docs/voice/twiml)
- [Twilio Gather Verb](https://www.twilio.com/docs/voice/twiml/gather)
- [Google Gemini API](https://ai.google.dev/docs)
- [Amazon Polly Voices](https://docs.aws.amazon.com/polly/latest/dg/voicelist.html)
