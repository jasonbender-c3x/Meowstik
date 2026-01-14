# Twilio SMS Webhook Implementation

## Overview

This implementation adds support for receiving and processing inbound SMS messages via Twilio webhooks. The system stores all incoming messages in the database, validates webhook signatures for security, and provides API endpoints for managing SMS data.

## Features

### 1. Webhook Endpoint
- **Endpoint**: `POST /api/twilio/webhook/sms`
- **Purpose**: Receives inbound SMS messages from Twilio
- **Security**: Validates Twilio webhook signatures
- **Response**: Returns TwiML acknowledgment message
- **Storage**: Automatically stores all incoming SMS in database

### 2. SMS Storage
All SMS messages are stored in the `sms_messages` table with the following fields:
- Message identifiers (Twilio SID, Account SID)
- Sender and recipient phone numbers
- Message body and media URLs
- Direction (inbound/outbound)
- Processing status
- Associated chat ID (for AI responses)
- Error tracking

### 3. API Endpoints

#### Get SMS Messages
```
GET /api/twilio/sms/stored
```
**Query Parameters:**
- `direction`: Filter by "inbound" or "outbound"
- `processed`: Filter by processing status (true/false)
- `limit`: Maximum number of results (default: 50)
- `phoneNumber`: Filter by sender or recipient phone number

**Response:**
```json
{
  "messages": [...],
  "count": 10
}
```

#### Get Single SMS
```
GET /api/twilio/sms/stored/:id
```
Returns a specific SMS message by its database ID.

#### Mark SMS as Processed
```
POST /api/twilio/sms/stored/:id/mark-processed
```
**Body:**
```json
{
  "chatId": "optional-chat-id",
  "responseMessageSid": "optional-response-sid"
}
```
Marks an SMS as processed, optionally linking it to a chat conversation.

#### Check Twilio Status
```
GET /api/twilio/status
```
Returns Twilio configuration status and account balance.

## Configuration

Set the following environment variables in your `.env` file:

```bash
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=your_twilio_phone_number
```

## Twilio Configuration

### 1. Set Up Webhook in Twilio Console

1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to Phone Numbers → Active Numbers
3. Select your Twilio phone number
4. Under "Messaging", set the webhook URL:
   ```
   https://your-domain.com/api/twilio/webhook/sms
   ```
5. Set HTTP Method to `POST`
6. Save your changes

### 2. Test Your Webhook

You can test the webhook using the provided test script:

```bash
# Make sure the server is running
npm run dev

# In another terminal, run the test
node /tmp/test-twilio-webhook.js
```

Or use ngrok for testing with real Twilio:

```bash
# Start ngrok tunnel
ngrok http 5000

# Use the ngrok URL in Twilio console
https://your-ngrok-id.ngrok.io/api/twilio/webhook/sms
```

## Security

### Webhook Signature Validation

The webhook endpoint validates Twilio's signature to ensure requests are authentic. This prevents malicious actors from sending fake SMS data to your endpoint.

The validation:
1. Extracts the `X-Twilio-Signature` header
2. Reconstructs the full webhook URL
3. Uses Twilio's SDK to validate the signature
4. Rejects requests with invalid signatures (403 Forbidden)

### Best Practices

- Always keep your `TWILIO_AUTH_TOKEN` secret
- Use HTTPS in production
- Monitor webhook logs for suspicious activity
- Regularly rotate your Twilio auth token

## Database Schema

The `sms_messages` table structure:

```sql
CREATE TABLE sms_messages (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  message_sid VARCHAR UNIQUE NOT NULL,
  account_sid VARCHAR NOT NULL,
  from VARCHAR NOT NULL,
  to VARCHAR NOT NULL,
  body TEXT NOT NULL,
  direction TEXT NOT NULL,
  status TEXT NOT NULL,
  num_media INTEGER DEFAULT 0,
  media_urls JSONB,
  processed BOOLEAN DEFAULT false NOT NULL,
  chat_id VARCHAR REFERENCES chats(id) ON DELETE SET NULL,
  response_message_sid VARCHAR,
  error_code INTEGER,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  processed_at TIMESTAMP
);
```

## Future Enhancements

### Planned Features

1. **AI Response Integration**
   - Automatically process incoming SMS with AI
   - Create chat sessions for SMS conversations
   - Send intelligent responses back via SMS

2. **SMS-to-Chat Bridge**
   - Link SMS conversations to web chat interface
   - Allow users to continue conversations across channels

3. **MMS Support**
   - Handle image/media attachments
   - Store media files in cloud storage
   - Process images with AI vision models

4. **SMS Templates**
   - Pre-defined response templates
   - Quick reply buttons
   - Auto-responses based on keywords

5. **Analytics Dashboard**
   - SMS volume metrics
   - Response time tracking
   - Popular keywords and intents

## Troubleshooting

### Webhook Not Receiving Messages

1. Check that your webhook URL is correct in Twilio console
2. Verify the server is accessible from the internet
3. Check server logs for any errors
4. Ensure `DATABASE_URL` is configured (messages are stored in DB)

### Signature Validation Failing

1. Verify `TWILIO_AUTH_TOKEN` matches your Twilio account
2. Check that the webhook URL in Twilio matches exactly (including https/http)
3. Ensure no proxy or CDN is modifying the request

### Messages Not Storing

1. Check database connection
2. Run `npm run db:push` to ensure schema is up to date
3. Check server logs for database errors

## API Testing

Test the SMS API endpoints:

```bash
# Make sure server is running
npm run dev

# Run API tests
node /tmp/test-sms-api.js
```

## Code Structure

```
server/
├── routes/
│   └── twilio.ts          # All Twilio API routes and webhook
├── integrations/
│   └── twilio.ts          # Twilio SDK integration layer
└── storage.ts             # Database operations for SMS

shared/
└── schema.ts              # SMS messages table definition
```

## Support

For issues or questions:
- Check the [Twilio documentation](https://www.twilio.com/docs/sms)
- Review server logs: `server/index.ts` log output
- Test webhook manually using the provided scripts

## License

This implementation follows the main project's MIT license.
