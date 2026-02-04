# Meowstic AI Receptionist - Implementation Guide

This document provides a comprehensive guide to the Meowstic AI Receptionist system, which uses Twilio Voice and Gemini Live (Multimodal API) to conduct natural, real-time voice conversations with callers. The system is designed to act as a receptionist—screening calls, answering questions, taking messages, and handling call handoffs.

## 1. System Architecture

The AI Receptionist operates using a bidirectional WebSocket stream for low-latency voice interaction.

### Request Flow
1.  **Incoming Call**: User calls your Twilio Phone Number.
2.  **Webhook Trigger**: Twilio sends a POST request to `https://<your-server>/api/twilio/webhooks/voice`.
3.  **TwiML Response**: The server answers with TwiML instructions to `<Connect>` to a Media Stream (`wss://<your-server>/streams/twilio`).
4.  **WebSocket Handshake**: Twilio opens a WebSocket connection to your server.
5.  **Gemini Live Session**: 
    *   The server initializes a session with Google's Gemini Multimodal Live API.
    *   **Audio In**: Audio from the caller is streamed from Twilio -> Server -> Gemini.
    *   **Audio Out**: Audio from Gemini is streamed from Gemini -> Server -> Twilio (played to caller).
6.  **Tool Use**: Gemini can invoke tools (e.g., `check_calendar`, `save_message`, `transfer_call`) during the conversation.

## 2. Configuration

### Environment Variables
Ensure these are set in your `.env` or deployment environment:

```bash
# Twilio Configuration
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+1555...

# Google/Gemini Configuration with Gemini 2.0 Flash (Multimodal)
GEMINI_API_KEY=... 

# Owner Details (for Handoffs/Alerts)
OWNER_PHONE_NUMBER=+1555...
OWNER_USER_ID=...
```

### Twilio Console Setup
1.  Go to **Phone Numbers** > **Manage** > **Active Numbers**.
2.  Click on your Meowstic number.
3.  Scroll to **Voice & Fax**.
4.  **A Call Comes In**: Select **Webhook**.
5.  **URL**: `https://<your-public-url>/api/twilio/webhooks/voice`
6.  **HTTP Method**: `POST`
7.  **Save**.

## 3. Configuring AI Behavior (Receptionist Persona)

The behavior of the AI on the phone is controlled by the **System Instruction** sent to the Gemini Live session. This is currently hardcoded in the WebSocket handler (usually `server/index.ts` or `server/routes/twilio.ts` where the stream connects), but ideally should be loaded from a prompt file.

### Default Persona "Meowstic Receptionist"
To customize the persona, modify the system prompt to include instructions like:
*   "You are Meowstic, a helpful personal receptionist for Jason."
*   "Your goal is to screen calls and take detailed messages."
*   "Be polite, professional, but concise."
*   "If the call is urgent, offer to try and patch them through."

### Example System Prompt Segment
```text
You are Meowstic, the AI receptionist.
1. Answer with "Hello, this is Meowstic, Jason's AI assistant. How may I help you?"
2. If the user asks for Jason, ask for their name and the reason for the call.
3. If it sounds urgent, use the [transfer_call] tool.
4. Otherwise, offer to take a message. Use the [save_message] tool to record it.
```

## 4. Feature Implementation Details

### A. Taking Messages
The system does not use traditional "Voicemail beep" recording. Instead, the AI *actively* takes the message during the conversation.

*   **Mechanism**: The user speaks the message.
*   **Capture**: Gemini processes the audio.
*   **Storage**: Gemini calls a `save_message(content, from_number)` tool.
*   **Database**: The message is stored in the `sms_messages` table (or a dedicated `messages` table) and linked to the caller.
*   **Notification**: The system can optionally send an SMS to the owner: *"New message from Mom: call me back."*

### B. Call Handoff (Live Transfer)
Transferring a call from the AI to you (the owner) requires breaking out of the WebSocket stream.

*   **User Intent**: Caller says "I need to speak to him right now, it's an emergency."
*   **AI Action**: Gemini invokes the `transfer_call(phone_number)` tool.
*   **Backend Logic**: 
    1.  The tool executes on the backend.
    2.  The backend uses the Twilio REST API to **update** the live call (`client.calls(callSid).update(...)`).
    3.  It replaces the current TwiML (the WebSocket stream) with new TwiML: `<Dial><Number>+1555...</Number></Dial>`.
    4.  The WebSocket closes, and endpoints connect directly via PSTN.

### C. Live Mode Conversation
The "Live Mode" refers to the low-latency interaction.
*   **Latency**: Typical latency is ~1-3 seconds depending on network conditions.
*   **Interruption**: Users can interrupt the AI (Barge-in). The system should handle this by clearing the audio buffer when speech is detected while the AI is speaking.

## 5. Deployment & Troubleshooting

### Production Deployment
*   **SSL Required**: WebSockets (`wss://`) and Webhooks (`https://`) require a valid SSL certificate.
*   **Public URL**: Your server must be publicly accessible (not localhost) for Twilio to reach it. Use `ngrok` for local testing.

### Common Issues
| Issue | Cause | Fix |
|-------|-------|-----|
| **One-way Audio** | Twilio can't reach WebSocket URL | Check firewall, use `wss://` protocol, verify public URL. |
| **High Latency** | Server location or processing delay | Host server closer to users/Twilio region. Use faster Gemini model. |
| **Call Drops immediately** | Webhook error or 500 status | Check server logs for startup errors. Verify `/api/twilio/webhooks/voice` route exists. |
| **"System Error" voice** | Invalid TwiML response | Ensure the webhook returns valid XML. |

## 6. Testing Call Flow

1.  **Call your Twilio Number** from a different phone.
2.  **Speak**: "Hi, I'm looking for the owner."
3.  **Verify**: The AI should respond roughly instantly.
4.  **Test Tool**: "Can you take a message? Tell him I'll be late."
5.  **Check Logs**: Verify `save_message` tool was called and database updated.
6.  **Test Handoff**: "Connect me to him, please." (If configured) -> Verify call redirects.
