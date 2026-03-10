# Twilio SMS Webhook Configuration

This document explains how to configure the Twilio SMS webhook for real-time message processing.

## Overview

The Twilio SMS webhook enables Meowstik to receive and respond to incoming text messages in real-time. When someone sends an SMS to your Twilio number, the message is automatically processed through the AI system, with responses sent back via SMS.

## Features

- **Real-time SMS Processing**: Incoming messages are immediately processed through the AI
- **Contact Recognition**: The system looks up senders in your Google Contacts
- **Context-Aware Responses**: Different access levels based on who's texting:
  - **Owner** (your phone number): Full access as if logged in
  - **Known Contacts**: Can ask personal questions about your whereabouts and activities
  - **Unknown Numbers**: Guest access with limited capabilities
- **Secure Webhook**: Validates X-Twilio-Signature header to ensure requests are from Twilio

## Setup Instructions

### 1. Environment Variables

Add these to your `.env` file:

```env
# Twilio Configuration (Required)
TWILIO_ACCOUNT_SID=your_account_sid_from_twilio
TWILIO_AUTH_TOKEN=your_auth_token_from_twilio
TWILIO_PHONE_NUMBER=your_twilio_phone_number

# Owner Identification (Required for owner privileges)
# IMPORTANT: Use E.164 format with country code (e.g., +15551234567 for US)
OWNER_PHONE_NUMBER=+15551234567  # Your phone number in E.164 format
OWNER_USER_ID=your_user_id_from_database  # Optional: your user ID for authenticated context
```

**Phone Number Format**: All phone numbers must use E.164 format:
- Start with `+` followed by country code
- US: `+1` followed by 10 digits (e.g., `+15551234567`)
- UK: `+44` followed by digits (e.g., `+447700900123`)
- See [E.164 format guide](https://www.twilio.com/docs/glossary/what-e164) for other countries

### 2. Configure Twilio Webhook

1. Log in to your [Twilio Console](https://console.twilio.com/)
2. Navigate to **Phone Numbers** → **Manage** → **Active Numbers**
3. Click on your Twilio phone number
4. Scroll to **Messaging Configuration**
5. Set the webhook URL:
   - **Production**: `https://your-production-domain.com/api/twilio/webhook/sms`
   - **HTTP Method**: `POST`
6. Click **Save**

**IMPORTANT**: The webhook URL must point to your **production server**, not your development environment. Twilio needs a publicly accessible URL.

### 3. Testing the Webhook

#### Local Testing with ngrok

For development/testing, you can use ngrok to create a public tunnel:

```bash
# Start ngrok tunnel
ngrok http 5000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Configure Twilio webhook: https://abc123.ngrok.io/api/twilio/webhook/sms
```

#### Send a Test SMS

Send a text message to your Twilio number. You should see:

1. Console logs showing the incoming message
2. Contact lookup (if configured)
3. AI processing
4. SMS response sent back to your phone

## How It Works

### Message Flow

```
┌─────────────┐
│   Sender    │
│  (Phone)    │
└──────┬──────┘
       │ SMS
       ▼
┌─────────────┐
│   Twilio    │
│  (Webhook)  │
└──────┬──────┘
       │ POST /api/twilio/webhook/sms
       ▼
┌─────────────────────────────────────┐
│  Meowstik Webhook Handler           │
│                                     │
│  1. Validate Signature              │
│  2. Lookup Sender in Contacts       │
│  3. Determine Auth Context          │
│     - Owner                         │
│     - Known Contact                 │
│     - Guest                         │
│  4. Create Chat                     │
│  5. Process with AI                 │
│  6. Execute Tool Calls              │
│     (including sms_send)            │
└─────────────────────────────────────┘
       │
       ▼
┌─────────────┐
│   Twilio    │
│  (SMS API)  │
└──────┬──────┘
       │ SMS Response
       ▼
┌─────────────┐
│   Sender    │
│  (Phone)    │
└─────────────┘
```

### Authentication Context

The webhook determines the sender's access level:

```typescript
if (from === OWNER_PHONE_NUMBER) {
  // Full authenticated access
  // Can access personal data, calendars, emails, etc.
}
else if (found_in_contacts) {
  // Authenticated as known contact
  // Can ask personal questions
  // Special handling for relationships (e.g., "The creator's mother")
}
else {
  // Guest access
  // Limited to safe, read-only tools
}
```

## Special Contact Handling

The system recognizes special relationships in contact names:

- **Mother/Mom**: Referred to as "The creator's mother"
- Can add more special relationships in the code

## Security

### Signature Validation

The webhook validates the `X-Twilio-Signature` header to ensure requests are genuinely from Twilio:

```typescript
const isValid = twilio.validateWebhookSignature(
  signature,
  url,
  requestBody
);
```

In **production mode**, requests with invalid or missing signatures are rejected with `403 Forbidden`.

In **development mode**, signature validation errors are logged but processing continues (for easier testing).

### Phone Number Normalization

Phone numbers are normalized before comparison to handle different formats:

```typescript
normalizePhoneNumber("+1 (555) 123-4567") // Returns: "15551234567"
normalizePhoneNumber("+15551234567")      // Returns: "15551234567"
```

## Troubleshooting

### Webhook Not Receiving Messages

1. **Check Twilio Configuration**:
   - Verify the webhook URL is correct
   - Ensure it's using HTTPS (required in production)
   - Confirm HTTP method is POST

2. **Check Server Logs**:
   ```bash
   # Look for Twilio webhook errors
   grep "Twilio" logs/server.log
   ```

3. **Test Signature Validation**:
   - Temporarily disable in dev: Set `NODE_ENV=development`
   - Check for signature validation errors in logs

### Contact Lookup Failing

1. **Verify Google Authentication**:
   - Ensure Google OAuth is configured
   - Check that the user is authenticated

2. **Check Contacts API Access**:
   - Verify Google People API is enabled in Google Cloud Console
   - Confirm OAuth scopes include People API access

### SMS Not Sending

1. **Check Twilio Balance**:
   - Verify your Twilio account has sufficient balance
   - Check for any account restrictions

2. **Verify Tool Execution**:
   ```bash
   # Check logs for sms_send tool execution
   grep "sms_send" logs/server.log
   ```

3. **Phone Number Format**:
   - Ensure phone numbers are in E.164 format: `+15551234567`

## API Reference

### Webhook Endpoint

**POST** `/api/twilio/webhook/sms`

**Headers**:
- `X-Twilio-Signature`: Twilio webhook signature (required in production)

**Body** (form-encoded):
- `From`: Sender's phone number (E.164 format)
- `Body`: Message text content
- `MessageSid`: Twilio message ID

**Response**: TwiML (XML)

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TWILIO_ACCOUNT_SID` | Yes | Your Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Yes | Your Twilio auth token |
| `TWILIO_PHONE_NUMBER` | Yes | Your Twilio phone number (E.164) |
| `OWNER_PHONE_NUMBER` | Recommended | Owner's phone number for authentication |
| `OWNER_USER_ID` | Optional | Owner's user ID from database |
| `GEMINI_API_KEY` | Yes | Google Gemini API key for AI |

## Examples

### Example SMS Conversation (Owner)

```
[Owner sends SMS]: "What's on my calendar today?"

[AI Response via SMS]: "You have 3 events today:
- 9 AM: Team standup
- 2 PM: Client meeting
- 5 PM: Gym"
```

### Example SMS Conversation (Known Contact)

```
[Mom sends SMS]: "Where is Jason?"

[AI Response via SMS]: "Hello Mom! Jason is currently at the office. His calendar shows he has a client meeting until 3 PM."
```

### Example SMS Conversation (Guest)

```
[Unknown number sends SMS]: "Send me Jason's email"

[AI Response via SMS]: "I'm sorry, but I can only share public information with unknown contacts. I can answer general questions or help with web searches."
```

## Future Enhancements

Potential features to add:

- [ ] Multi-turn conversations (maintain context across multiple SMS)
- [ ] Media message support (MMS)
- [ ] Voice call integration
- [ ] SMS conversation history in UI
- [ ] Custom auto-replies based on time/availability
- [ ] Group messaging support
- [ ] Scheduled SMS
- [ ] SMS templates

## Related Documentation

- [Twilio API Documentation](https://www.twilio.com/docs/sms)
- [Google Contacts Integration](./google-contacts.md)
- [Authentication System](./authentication.md)
