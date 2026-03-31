# Twilio SMS Integration - Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the Twilio SMS integration for Meowstik AI assistant. The integration enables real-time SMS messaging with AI-powered responses, contact recognition, and owner authentication.

## Prerequisites

Before deploying, ensure you have:

1. **Twilio Account**: Sign up at [twilio.com](https://www.twilio.com/try-twilio)
2. **Twilio Phone Number**: Purchase a phone number with SMS capabilities
3. **Google Cloud Setup**: For contact lookup (Google People API)
4. **Gemini API Key**: For AI processing
5. **Public Server**: Production deployment or ngrok for development

## Deployment Steps

### 1. Configure Environment Variables

Add the following secrets to your `.env` file (or Replit Secrets):

```env
# Twilio Credentials (Required)
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+15551234567

# Owner Authentication (Critical for authenticated access)
OWNER_PHONE_NUMBER=+15551234567  # Your personal cell phone (E.164 format)
OWNER_USER_ID=your_user_id       # Optional: your UUID from users table

# AI Processing (Required)
GEMINI_API_KEY=your_gemini_api_key

# Google OAuth (Required for contact lookup)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

#### Important Notes:

- **E.164 Format**: All phone numbers must use E.164 format (e.g., `+15551234567` for US numbers)
- **OWNER_PHONE_NUMBER**: This is **critical** for the system to recognize you as the authenticated owner
- **OWNER_USER_ID**: Optional but recommended to link SMS interactions to your main account profile

### 2. Deploy to a Public Server

Twilio webhooks require a publicly accessible HTTPS URL. Choose one of these deployment options:

#### Option A: Production Deployment (Recommended)

Deploy to a platform like:
- **Replit**: Automatic HTTPS domain
- **Railway**: Simple deployment with custom domains
- **Heroku**: Classic PaaS with add-ons
- **AWS/GCP/Azure**: Full control and scalability

After deployment, note your public URL (e.g., `https://your-app.replit.app`)

#### Option B: Development/Testing with ngrok

For local development, use ngrok to create a public tunnel:

```bash
# Install ngrok
npm install -g ngrok

# Start your development server
npm run dev

# In another terminal, start ngrok
ngrok http 5000

# You'll see output like:
# Forwarding: https://abc123.ngrok.io -> http://localhost:5000
```

⚠️ **Important**: 
- ngrok URLs change on each restart (unless you have a paid account)
- Remember to update the Twilio webhook URL when ngrok restarts
- For production, always use a stable, permanent URL

### 3. Configure Twilio Webhook

Once your server is running and publicly accessible:

1. Go to the **Twilio Console** → [Phone Numbers](https://console.twilio.com/us1/develop/phone-numbers/manage/incoming)
2. Click **Manage** → **Active Numbers**
3. Select your Twilio phone number
4. Scroll to **Messaging Configuration** section
5. Under "**A MESSAGE COMES IN**":
   - Select **Webhook**
   - Enter your webhook URL: `https://your-domain.com/api/twilio/webhook/sms`
   - Set HTTP Method to **POST**
6. Click **Save** at the bottom

**Example URLs**:
- Production: `https://meowstik.replit.app/api/twilio/webhook/sms`
- Development: `https://abc123.ngrok.io/api/twilio/webhook/sms`

⚠️ **Critical**: The URL must be **exactly** what your server sees, including:
- Protocol (`https://`)
- Domain
- Path (`/api/twilio/webhook/sms`)

Any mismatch will cause signature validation to fail.

### 4. Verify and Test

Send a test SMS to your Twilio number to verify the complete flow:

#### Test 1: Owner Recognition

Send an SMS from your `OWNER_PHONE_NUMBER`:

```
SMS: "What's on my calendar today?"
```

Expected behavior:
- AI recognizes you as the owner
- Has access to your Google Calendar
- Responds with your actual events

Check server logs for:
```
[Twilio] Incoming SMS from +15551234567: What's on my calendar today?
[Twilio] SMS from owner: +15551234567
[Twilio] Executing tool: sms_send
```

#### Test 2: Contact Recognition

Have a known contact (in your Google Contacts) send an SMS:

```
SMS: "Where is [Owner Name]?"
```

Expected behavior:
- AI looks up the sender in Google Contacts
- Identifies the relationship (e.g., "Mom")
- Provides personalized response

#### Test 3: Guest Access

Send from an unknown number (or use a different phone):

```
SMS: "Hello, who are you?"
```

Expected behavior:
- AI treats sender as guest
- Provides limited, safe responses
- No access to personal data

### 5. Monitoring and Logs

Monitor your deployment logs for Twilio-related messages:

```bash
# If using Replit
# Check the Console tab

# If using Railway/Heroku
railway logs --tail
# or
heroku logs --tail

# Look for these log prefixes:
[Twilio] Incoming SMS from...
[Twilio] Contact lookup...
[Twilio] SMS from owner...
[Twilio] Executing tool: sms_send
```

## Common Issues and Troubleshooting

### Issue 1: Webhook Returns 403 Forbidden

**Cause**: Signature validation failure

**Solutions**:
1. Verify `TWILIO_AUTH_TOKEN` is correct
2. Ensure webhook URL in Twilio Console exactly matches your server URL
3. Check for proxies/CDNs that might modify the request
4. For development testing, temporarily set `NODE_ENV=development` (disables strict validation)

### Issue 2: No SMS Response Received

**Cause**: Various possibilities

**Debugging steps**:
1. Check Twilio account balance: [Console → Balance](https://console.twilio.com/us1/billing/manage-billing/billing-overview)
2. Verify server logs show `sms_send` tool execution
3. Check Twilio SMS logs: [Console → Monitor → Logs → Messages](https://console.twilio.com/us1/monitor/logs/sms)
4. Ensure `GEMINI_API_KEY` is configured correctly

### Issue 3: Contact Lookup Not Working

**Cause**: Google People API not configured

**Solutions**:
1. Enable Google People API in [Google Cloud Console](https://console.cloud.google.com/apis/library/people.googleapis.com)
2. Verify OAuth scopes include People API access
3. Re-authenticate the Google OAuth connection
4. Check phone numbers are in E.164 format in your contacts

### Issue 4: AI Not Recognizing Owner

**Cause**: Phone number mismatch

**Solutions**:
1. Ensure `OWNER_PHONE_NUMBER` is in E.164 format: `+15551234567`
2. Verify no spaces or special characters (except `+`)
3. Check sender's number matches exactly (including country code)
4. Test phone number normalization:
   ```bash
   # From Twilio logs, compare:
   [Twilio] Incoming SMS from +15551234567
   # With your .env:
   OWNER_PHONE_NUMBER=+15551234567
   ```

### Issue 5: Server Not Receiving Webhook

**Cause**: Network/firewall issues

**Solutions**:
1. Verify server is running: `curl https://your-domain.com/api/health`
2. Check firewall rules allow incoming HTTPS
3. For ngrok: Ensure tunnel is active and URL is up-to-date
4. Test webhook manually:
   ```bash
   curl -X POST https://your-domain.com/api/twilio/webhook/sms \
     -d "From=+15551234567" \
     -d "Body=Test message" \
     -d "MessageSid=SM123"
   ```

## Security Considerations

### 1. Signature Validation

The webhook validates the `X-Twilio-Signature` header to prevent spoofed requests:

```typescript
// Production mode (NODE_ENV=production)
if (!isValid) {
  return res.status(403).send("Forbidden: Invalid Twilio Signature");
}

// Development mode (NODE_ENV=development)
if (!isValid) {
  console.warn("[Twilio] Signature validation failed (dev mode)");
  // Continues processing for testing
}
```

**Best Practices**:
- Always use signature validation in production
- Keep `TWILIO_AUTH_TOKEN` secret
- Rotate auth tokens periodically
- Monitor for repeated validation failures

### 2. Authentication Tiers

The system implements tiered access control:

| Tier | Recognition | Access Level | Use Cases |
|------|-------------|--------------|-----------|
| **Owner** | Phone matches `OWNER_PHONE_NUMBER` | Full authenticated access | Personal calendar, emails, tasks |
| **Known Contact** | Found in Google Contacts | Enhanced guest access | Asking about owner's whereabouts |
| **Guest** | Unknown number | Restricted read-only | General questions, web searches |

### 3. Rate Limiting

Consider implementing rate limits to prevent abuse:

- **Per-sender limits**: Max messages per hour
- **Global limits**: Total messages per day
- **Cost protection**: Alert on high Twilio usage

(Note: Rate limiting is not currently implemented but recommended for production)

## Performance Optimization

### Recommended Settings

```env
# Limit contact search results (default: 10)
# Lower = faster lookup, higher = better accuracy
GOOGLE_CONTACTS_SEARCH_LIMIT=10

# Enable response caching (future enhancement)
# REDIS_URL=your_redis_url
```

### Expected Latency

Typical response times:
- **Webhook acknowledgment**: < 100ms (immediate TwiML response)
- **Contact lookup**: 200-500ms (Google People API)
- **AI processing**: 1-3 seconds (Gemini Flash)
- **SMS delivery**: 1-5 seconds (Twilio)
- **Total**: 3-10 seconds from send to receive

## Production Checklist

Before going live, verify:

- [ ] All environment variables are set correctly
- [ ] `OWNER_PHONE_NUMBER` is in E.164 format
- [ ] Twilio webhook URL points to production server (HTTPS)
- [ ] Webhook signature validation is enabled (`NODE_ENV=production`)
- [ ] Google People API is enabled and authenticated
- [ ] Gemini API key is valid and has quota
- [ ] Twilio account has sufficient balance
- [ ] Test SMS sent and response received
- [ ] Server logs show successful processing
- [ ] Error monitoring is configured (e.g., Sentry)
- [ ] Backup/restore procedures are documented

## Cost Estimates

Typical costs for Twilio SMS integration:

| Item | Cost | Notes |
|------|------|-------|
| Twilio Phone Number | $1/month | US local number |
| Incoming SMS | $0.0075/message | Per message received |
| Outgoing SMS | $0.0075/message | Per message sent |
| Gemini API (Flash) | $0.075/1M chars | Input + output |
| Google People API | Free | 600 queries/min/project |

**Example**: 100 SMS conversations/month
- Incoming: 100 × $0.0075 = $0.75
- Outgoing: 100 × $0.0075 = $0.75
- Phone number: $1.00
- **Total**: ~$2.50/month (excluding Gemini API)

## Next Steps

After successful deployment:

1. **Monitor Usage**: Track SMS volume and costs
2. **Optimize Prompts**: Fine-tune AI responses for SMS brevity
3. **Add Features**: Implement multi-turn conversations, MMS support
4. **Scale**: Add multiple phone numbers, team access
5. **Analytics**: Track popular queries, response times

## Support Resources

- **Twilio Documentation**: [twilio.com/docs/sms](https://www.twilio.com/docs/sms)
- **Signature Validation**: [twilio.com/docs/usage/security#validating-requests](https://www.twilio.com/docs/usage/security#validating-requests)
- **E.164 Format**: [twilio.com/docs/glossary/what-e164](https://www.twilio.com/docs/glossary/what-e164)
- **Google People API**: [developers.google.com/people](https://developers.google.com/people)
- **Gemini API**: [ai.google.dev](https://ai.google.dev)

## Related Documentation

- [Twilio SMS Webhook Configuration](./twilio-sms-webhook.md) - Technical implementation details
- [Twilio Implementation Summary](./TWILIO_IMPLEMENTATION_SUMMARY.md) - Architecture overview
- [Twilio Conversational Calling](./TWILIO_CONVERSATIONAL_CALLING.md) - Voice integration
- [Voice Synthesis Setup](./VOICE_SYNTHESIS_SETUP.md) - TTS configuration

---

**Status**: Production-ready  
**Last Updated**: January 2026  
**Maintainer**: Meowstik Team
