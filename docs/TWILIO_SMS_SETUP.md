# Twilio SMS Integration - Complete Setup Guide

This guide walks you through configuring and deploying the Twilio SMS integration for Meowstik AI assistant.

## Overview

The Twilio SMS integration enables Meowstik to receive and respond to text messages in real-time. When someone sends an SMS to your Twilio number, the message is automatically processed through the AI system with responses sent back via SMS.

## Prerequisites

Before you begin, you'll need:

1. **A Twilio Account**: Sign up at [twilio.com](https://www.twilio.com/try-twilio)
2. **A Twilio Phone Number**: Purchase one from the Twilio Console
3. **A Public Server**: Deploy your application to a publicly accessible URL (Twilio cannot reach localhost)
4. **Google Gemini API Key**: Required for AI processing
5. **PostgreSQL Database**: For storing message history

## Step 1: Configure Environment Variables

Add the following secrets to your `.env` file (or your hosting platform's secret management):

### Required Variables

```env
# Twilio Credentials (from Twilio Console)
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+15551234567

# Owner Identification (critical for authentication)
OWNER_PHONE_NUMBER=+15551234567  # Your personal phone in E.164 format
OWNER_USER_ID=your_user_uuid      # Optional: Your UUID from users table

# AI Processing (required)
GEMINI_API_KEY=your_gemini_api_key_here
```

### Finding Your Twilio Credentials

1. Log in to [Twilio Console](https://console.twilio.com/)
2. Navigate to **Account** → **Account Info**
3. Copy your **Account SID** and **Auth Token**
4. For your phone number:
   - Go to **Phone Numbers** → **Manage** → **Active Numbers**
   - Copy your phone number in E.164 format (e.g., `+15551234567`)

### Important Notes

- **OWNER_PHONE_NUMBER**: This is **critical** for the system to recognize you as the authenticated owner. Use E.164 format with country code (e.g., `+15551234567` for US, `+447700900123` for UK).
- **OWNER_USER_ID**: Optional, but recommended. This links SMS interactions to your main account profile. Find it by querying your `users` table in the database.
- All phone numbers must use E.164 format: `+` followed by country code and number with no spaces or special characters.

### E.164 Phone Number Format

The E.164 format is the international standard for phone numbers:

| Country       | Format Example    | Pattern                    |
|---------------|-------------------|----------------------------|
| United States | +15551234567      | +1 followed by 10 digits   |
| United Kingdom| +447700900123     | +44 followed by digits     |
| Australia     | +61412345678      | +61 followed by digits     |
| Canada        | +14165551234      | +1 followed by 10 digits   |

See [Twilio's E.164 guide](https://www.twilio.com/docs/glossary/what-e164) for other countries.

## Step 2: Deploy to a Public Server

Twilio webhooks require a publicly accessible HTTPS URL. You cannot use `localhost` for production.

### Option A: Deploy to Replit

1. Push your code to the Replit project
2. Click **Deploy** in the Replit interface
3. Your webhook URL will be: `https://your-repl-name.replit.app/api/twilio/webhook/sms`

### Option B: Deploy to Other Platforms

Popular hosting options:
- **Vercel**: `https://your-app.vercel.app/api/twilio/webhook/sms`
- **Railway**: `https://your-app.railway.app/api/twilio/webhook/sms`
- **Render**: `https://your-app.onrender.com/api/twilio/webhook/sms`
- **Fly.io**: `https://your-app.fly.dev/api/twilio/webhook/sms`

### Option C: Local Development with ngrok

For testing locally before deployment:

```bash
# Install ngrok (if not already installed)
# Visit https://ngrok.com/download

# Start your local server
npm run dev

# In a new terminal, create a tunnel
ngrok http 5000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Your webhook URL: https://abc123.ngrok.io/api/twilio/webhook/sms
```

**Important**: ngrok URLs change every time you restart, so this is only for testing.

## Step 3: Configure Twilio Webhook

Once your server is running on a public URL, configure Twilio to send incoming SMS data to your application:

### Step-by-Step Instructions

1. **Log in to Twilio Console**: Navigate to [console.twilio.com](https://console.twilio.com/)

2. **Access Phone Numbers**: 
   - Click **Phone Numbers** in the left sidebar
   - Select **Manage** → **Active Numbers**

3. **Select Your Twilio Number**: Click on the phone number you want to configure

4. **Configure Messaging Webhook**:
   - Scroll down to the **Messaging Configuration** section
   - Under "A MESSAGE COMES IN":
     - Select **Webhook** from the dropdown
     - Enter your full webhook URL: `https://your-domain.com/api/twilio/webhook/sms`
     - Set HTTP Method to **POST**

5. **Save Configuration**: Click **Save** at the bottom of the page

### Webhook URL Format

Your webhook URL must be:
```
https://your-production-domain.com/api/twilio/webhook/sms
```

Replace `your-production-domain.com` with:
- Your Replit deployment URL
- Your custom domain
- Your ngrok URL (for testing only)

## Step 4: Verify and Test

Send a test SMS to your Twilio number to verify the complete flow.

### Expected Behavior

1. **Signature Validation**: The server validates the `X-Twilio-Signature` header to ensure the request is from Twilio (not spoofed)
2. **Owner Recognition**: 
   - If you text from `OWNER_PHONE_NUMBER`, the AI recognizes you and has full access to authenticated tools (Calendar, Gmail, etc.)
3. **Contact Recognition**:
   - If the sender is in your Google Contacts, the AI addresses them by name
4. **Guest Access**:
   - Unknown numbers receive responses with restricted, safe-only access
5. **AI Response**: You should receive an SMS response within seconds

### Testing Checklist

- [ ] Send SMS from your `OWNER_PHONE_NUMBER` → Should get personalized response with full access
- [ ] Send SMS from a known contact's number → Should be addressed by name
- [ ] Send SMS from an unknown number → Should get guest-level response
- [ ] Check server logs for `[Twilio]` entries showing message processing
- [ ] Verify messages are stored in the database (`sms_messages` table)

### Example SMS Conversations

**Owner SMS:**
```
You: What's on my calendar today?
AI: You have 3 events:
- 9 AM: Team standup
- 2 PM: Client meeting with Acme Corp
- 5 PM: Gym
```

**Known Contact:**
```
Mom: Where is Jason?
AI: Hello Mom! Jason is currently at the office. His calendar shows a client meeting until 3 PM.
```

**Unknown Number:**
```
Unknown: Send me Jason's email
AI: I'm sorry, I can only share public information with unknown contacts. I can help with general questions or web searches.
```

## Troubleshooting

### Issue: Webhook Not Receiving Messages

**Symptoms**: You send an SMS but nothing happens; no response received.

**Solutions**:

1. **Check Twilio Configuration**:
   - Verify webhook URL is correct in Twilio Console
   - Ensure URL uses HTTPS (HTTP is not allowed in production)
   - Confirm HTTP method is set to POST
   - Check for typos in the URL

2. **Check Server Status**:
   - Ensure your server is running and publicly accessible
   - Test the URL directly in a browser or with curl:
     ```bash
     curl https://your-domain.com/api/twilio/webhook/sms
     ```
   - Check server logs for errors or crashes

3. **Review Twilio Debugger**:
   - Go to Twilio Console → **Monitor** → **Logs** → **Errors**
   - Look for webhook failures and HTTP error codes

### Issue: 403 Forbidden - Signature Validation Failed

**Symptoms**: Server logs show "Forbidden: Invalid Twilio Signature"

**Cause**: The webhook signature validation is failing, usually due to URL mismatch.

**Solutions**:

1. **Verify AUTH_TOKEN**:
   - Ensure `TWILIO_AUTH_TOKEN` in `.env` matches your Twilio Console
   - Auth Token is case-sensitive

2. **Check URL Match**:
   - The URL configured in Twilio Console must **exactly** match what the server sees
   - Include protocol (https://), domain, and path
   - Example mismatch:
     - Twilio Console: `https://example.com/api/twilio/webhook/sms`
     - Server sees: `http://example.com/api/twilio/webhook/sms` (http vs https)

3. **Development Mode Workaround**:
   - For local testing, set `NODE_ENV=development`
   - This logs signature warnings but continues processing
   - **Never use this in production**

### Issue: Contact Lookup Not Working

**Symptoms**: Known contacts aren't recognized; everyone is treated as guest.

**Solutions**:

1. **Verify Google OAuth**:
   - Ensure `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are configured
   - Check that you're logged into the app at least once

2. **Check People API Access**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to **APIs & Services** → **Enabled APIs**
   - Ensure "People API" is enabled
   - Verify OAuth scopes include People API access

3. **Phone Number Format**:
   - Contacts' phone numbers must be in E.164 format in Google Contacts
   - Example: Store as `+15551234567`, not `(555) 123-4567`

### Issue: SMS Not Sending

**Symptoms**: AI processes the message but no reply is received.

**Solutions**:

1. **Check Twilio Account Balance**:
   - Go to Twilio Console → **Billing**
   - Ensure you have sufficient balance
   - SMS costs approximately $0.0075-0.01 per message

2. **Review Account Restrictions**:
   - Trial accounts can only send to verified numbers
   - Upgrade to a paid account to send to any number

3. **Check Logs**:
   - Look for `sms_send` tool execution in server logs
   - Check for error messages from Twilio API

4. **Verify Phone Number Format**:
   - Ensure recipient numbers are in E.164 format
   - Example: `+15551234567`, not `555-123-4567`

### Issue: AI Responses Are Too Long for SMS

**Symptoms**: Responses get truncated or split into multiple messages.

**Solutions**:

1. The system prompt already instructs the AI to keep SMS responses concise
2. If needed, you can further customize the prompt in `server/routes/twilio.ts`
3. Twilio automatically splits messages over 160 characters into multiple segments (billed accordingly)

## Security Considerations

### Signature Validation

The webhook validates the `X-Twilio-Signature` header to ensure requests are genuinely from Twilio:

```typescript
const isValid = twilio.validateRequest(
  authToken,
  signature,
  url,
  requestBody
);
```

- **Production**: Invalid signatures are rejected with `403 Forbidden`
- **Development**: Warnings logged but processing continues (for testing)

### Authentication Tiers

The system implements three security levels:

1. **Owner** (`OWNER_PHONE_NUMBER`):
   - Full authenticated access
   - Can access personal data (emails, calendar, drive, etc.)
   - Same permissions as logged-in web user

2. **Known Contact** (in Google Contacts):
   - Guest access with enhanced context
   - Can ask personal questions about your whereabouts
   - Special relationship handling (e.g., "The creator's mother")

3. **Unknown Number**:
   - Restricted guest access
   - Safe, read-only tools only
   - Cannot access personal information

### Phone Number Privacy

- Phone numbers are normalized before storage
- Personal owner number is never exposed in logs or responses
- Contact information requires authentication to access

## Advanced Configuration

### Custom System Prompts

Modify the AI's personality for SMS interactions by editing `server/routes/twilio.ts`:

```typescript
const systemPrompt = `You are Meowstik, a helpful AI assistant responding via SMS.
Keep responses brief and conversational for text messaging.
${senderContext}`;
```

### Database Schema

SMS messages are stored in the `sms_messages` table:

```sql
CREATE TABLE sms_messages (
  id UUID PRIMARY KEY,
  sid TEXT NOT NULL,           -- Twilio message SID
  account_sid TEXT NOT NULL,
  from TEXT NOT NULL,           -- Sender's phone (E.164)
  to TEXT NOT NULL,             -- Recipient's phone (E.164)
  body TEXT NOT NULL,           -- Message content
  direction TEXT NOT NULL,      -- 'inbound' or 'outbound'
  status TEXT NOT NULL,         -- 'received', 'sent', 'failed', etc.
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Rate Limiting

Consider implementing rate limiting for production:

```typescript
// Example: Limit to 10 messages per minute per phone number
import rateLimit from 'express-rate-limit';

const smsLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  keyGenerator: (req) => req.body.From,
});

twilioRouter.post("/webhooks/sms", smsLimiter, async (req, res) => {
  // ... existing code
});
```

## Cost Estimation

Typical Twilio SMS costs (as of 2024):

| Service                | Cost per Message |
|------------------------|------------------|
| US/Canada SMS Incoming | $0.0075         |
| US/Canada SMS Outgoing | $0.0075         |
| UK SMS Incoming        | $0.011          |
| UK SMS Outgoing        | $0.04           |

**Monthly Cost Example** (100 SMS conversations):
- 100 incoming messages: $0.75
- 100 outgoing replies: $0.75
- **Total**: ~$1.50/month

See [Twilio Pricing](https://www.twilio.com/sms/pricing) for other countries.

## Next Steps

After successful deployment:

1. **Monitor Usage**: Check Twilio Console for message logs and usage
2. **Set Up Alerts**: Configure alerts for failed messages or low balance
3. **Collect Feedback**: Test with friends/family to refine AI responses
4. **Scale Up**: Consider upgrading to a paid Twilio account for unrestricted sending
5. **Add Features**: Explore MMS support, group messaging, or scheduled messages

## Additional Resources

- **Twilio Documentation**: [Programmable SMS](https://www.twilio.com/docs/sms)
- **Google Contacts API**: [People API Guide](https://developers.google.com/people)
- **Webhook Guide**: [docs/exhibit/02-integrations/twilio-sms-webhook.md](exhibit/02-integrations/twilio-sms-webhook.md)
- **E.164 Format**: [Twilio E.164 Guide](https://www.twilio.com/docs/glossary/what-e164)
- **ngrok**: [Getting Started with ngrok](https://ngrok.com/docs/getting-started)

## Support

If you encounter issues not covered in this guide:

1. Check the [Twilio Console Debugger](https://console.twilio.com/monitor/logs/debugger)
2. Review server logs for `[Twilio]` tagged messages
3. Consult the [Twilio Support Center](https://support.twilio.com)
4. Open an issue on the Meowstik GitHub repository

---

**Last Updated**: January 2026  
**Status**: Production Ready ✅
