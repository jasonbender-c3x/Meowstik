# 🚀 Quick Start Guide - Meowstik

**Get up and running in 5 minutes!**

This guide will help you start the Meowstik application and test the newly implemented features:
- SMS Integration (AI-powered)
- Voice Lab (AI text generation & voice testing)
- Sound Settings (cost optimization)
- Communications Hub (SMS/Calls/Voicemail)

---

## Prerequisites

- **Node.js** 18+ and npm
- **PostgreSQL** database (local or cloud)
- **Google Cloud Project** with APIs enabled
- **Twilio Account** (for SMS features)
- **Gemini API Key** (from Google AI Studio)

---

## Step 1: Install Dependencies

```bash
# Navigate to project directory
cd /path/to/Meowstik

# Install all dependencies
npm install
```

**Expected Output**: 
```
added 500+ packages in 30s
```

---

## Step 2: Set Up Environment Variables

### Copy the example file
```bash
cp .env.example .env
```

### Configure your `.env` file

Open `.env` in your editor and fill in these **essential** variables:

#### Database (Required)
```env
DATABASE_URL=postgresql://user:password@localhost:5432/meowstik
```

#### Google OAuth (Required for login)
```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback
```

**Where to get these:**
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or use existing)
3. Enable Google+ API
4. Go to "Credentials" → "Create Credentials" → "OAuth 2.0 Client ID"
5. Set authorized redirect URI: `http://localhost:5000/api/auth/google/callback`

#### Gemini API (Required for AI features)
```env
GEMINI_API_KEY=your_gemini_api_key
```

**Where to get this:**
1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Click "Get API Key"
3. Copy your key

#### Twilio (Required for SMS features)
```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+15551234567
OWNER_PHONE_NUMBER=+15551234567
```

**Where to get these:**
1. Go to [Twilio Console](https://console.twilio.com/)
2. Get Account SID and Auth Token from dashboard
3. Buy a phone number (Phone Numbers → Buy a number)
4. Set `OWNER_PHONE_NUMBER` to YOUR personal phone in E.164 format

#### Optional: Development Mode (Skip login for testing)
```env
HOME_DEV_MODE=true
HOME_DEV_EMAIL=your-email@example.com
```

**⚠️ WARNING**: Only use `HOME_DEV_MODE=true` on your local machine!

---

## Step 3: Set Up Database

### Create the database
```bash
# PostgreSQL command line
createdb meowstik
```

### Run migrations
```bash
npm run db:push
```

**Expected Output**:
```
✓ Database schema up to date
```

---

## Step 4: Start the Application

### Option A: Development Mode (Recommended)

**Terminal 1 - Start Backend Server:**
```bash
npm run dev
```

**Expected Output**:
```
[Server] Server running on http://localhost:5000
[Server] Database connected
```

**Terminal 2 - Start Frontend Dev Server:**
```bash
npm run dev:client
```

**Expected Output**:
```
VITE v5.x.x  ready in 500 ms

➜  Local:   http://localhost:5000
➜  Network: use --host to expose
```

### Option B: Production Build

```bash
# Build the application
npm run build

# Start production server
npm start
```

---

## Step 5: Access the Application

### Open in Browser
```
http://localhost:5000
```

### First Time Setup

1. **Login Screen** will appear (unless `HOME_DEV_MODE=true`)
2. Click **"Sign in with Google"**
3. Select your Google account
4. Grant permissions
5. You'll be redirected to the main chat interface

---

## Step 6: Test New Features

### 🎤 Voice Lab (`/voice-lab`)

Navigate to: `http://localhost:5000/voice-lab`

**Test AI Text Generation:**
1. Click "Greeting" under Quick Scenarios
2. Watch AI generate expressive text
3. Select a voice (try "Kore")
4. Click "Speak" to hear it

**Try Custom Prompts:**
1. Enter: "Explain quantum computing to a 5-year-old"
2. Click "Generate Text"
3. Select different voices
4. Adjust expressiveness styles
5. Try speech rate and pitch sliders

**Test SSML Effects:**
1. Go to "Sound Effects" tab
2. Click various effects to insert into text
3. Hear the difference when you speak

---

### ⚙️ Sound Settings (`/sound-settings`)

Navigate to: `http://localhost:5000/sound-settings`

**Test Cost Calculator:**
1. Move the verbosity slider (Mute → Low → Normal → Experimental)
2. Watch cost multiplier change
3. Adjust "Monthly Messages" slider
4. See cost calculations update in real-time

**Review Recommendations:**
- Check "Cost Optimization Tips"
- Compare service pricing
- Review Quality vs Cost matrix

---

### 💬 Communications Hub (`/communications`)

Navigate to: `http://localhost:5000/communications`

**View SMS Conversations:**
1. You'll see any existing SMS conversations
2. Click a conversation to view message thread
3. Type a message and click Send

**If no conversations exist:**
- Send an SMS to your Twilio number from your phone
- The conversation will appear automatically (polls every 5 seconds)

---

### 📱 SMS Integration (via Phone)

**Test AI-Powered SMS:**

1. **From your phone**, send an SMS to your Twilio phone number:
   ```
   What's on my calendar today?
   ```

2. **AI will respond** with your calendar events (if authenticated as owner)

3. **Try other commands:**
   ```
   Check my email
   Create a task: Buy groceries
   What's the weather?
   ```

**Owner Authentication:**
- If you text from `OWNER_PHONE_NUMBER`, you get FULL tool access
- If you text from another number, you get limited guest access

---

## Step 7: Configure Twilio Webhook (For SMS)

**⚠️ Important**: Twilio needs to send incoming SMS to your server.

### For Local Testing (Using ngrok)

1. **Install ngrok:**
   ```bash
   npm install -g ngrok
   ```

2. **Start ngrok tunnel:**
   ```bash
   ngrok http 5000
   ```

3. **Copy the HTTPS URL** (e.g., `https://abc123.ngrok.io`)

4. **Configure Twilio:**
   - Go to [Twilio Console](https://console.twilio.com/)
   - Phone Numbers → Manage → Active Numbers
   - Click your phone number
   - Scroll to "Messaging Configuration"
   - A MESSAGE COMES IN: **Webhook**
   - URL: `https://abc123.ngrok.io/api/twilio/webhook/sms`
   - HTTP Method: **POST**
   - Click **Save**

### For Production (Replit/Vercel/etc.)

Use your production domain:
```
https://meowstik.com/api/twilio/webhook/sms
```

See [docs/TWILIO_SMS_SETUP.md](docs/TWILIO_SMS_SETUP.md) for detailed deployment instructions.

---

## 🎯 Verification Checklist

After starting the app, verify everything works:

- [ ] **App loads** at http://localhost:5000
- [ ] **Login works** (or HOME_DEV_MODE bypasses it)
- [ ] **Chat interface** appears
- [ ] **Voice Lab** (`/voice-lab`) loads
  - [ ] AI generates text from scenarios
  - [ ] Voice selection works
  - [ ] Speak button plays audio
- [ ] **Sound Settings** (`/sound-settings`) loads
  - [ ] Verbosity slider moves
  - [ ] Cost calculations update
- [ ] **Communications** (`/communications`) loads
  - [ ] Tabs switch (Messages/Calls/Voicemail)
  - [ ] Search box works
- [ ] **SMS Integration** works
  - [ ] Send SMS to Twilio number
  - [ ] AI responds within 30 seconds
  - [ ] Response appears in Communications tab

---

## 🐛 Troubleshooting

### "Cannot connect to database"

**Problem**: PostgreSQL connection failed

**Solutions**:
```bash
# Check if PostgreSQL is running
pg_isready

# Check connection string format
DATABASE_URL=postgresql://username:password@host:port/database

# Common issues:
# - Wrong username/password
# - PostgreSQL not running
# - Database doesn't exist (run: createdb meowstik)
```

---

### "GOOGLE_CLIENT_ID is not defined"

**Problem**: Environment variables not loaded

**Solutions**:
```bash
# Make sure .env file exists
ls -la .env

# Check .env has proper format (no quotes around values)
cat .env

# Restart the server after editing .env
npm run dev
```

---

### "Unauthorized" when testing SMS

**Problem**: OWNER_PHONE_NUMBER doesn't match your phone

**Solutions**:
```bash
# Make sure phone number is in E.164 format
# Correct: +15551234567
# Wrong: (555) 123-4567, 555-123-4567

# Check environment variable
echo $OWNER_PHONE_NUMBER

# Verify in .env file
grep OWNER_PHONE_NUMBER .env
```

---

### "Twilio signature validation failed"

**Problem**: Webhook URL mismatch

**Solutions**:
1. **Check ngrok URL** is correct in Twilio Console
2. **Restart ngrok** if URL changed
3. **Update Twilio webhook** with new URL
4. **Check TWILIO_AUTH_TOKEN** is correct

---

### Voice Lab: "Failed to generate text"

**Problem**: Gemini API issue

**Solutions**:
```bash
# Verify API key is valid
curl https://generativelanguage.googleapis.com/v1beta/models?key=YOUR_KEY

# Check quota at https://aistudio.google.com/

# Make sure .env has the key
grep GEMINI_API_KEY .env
```

---

### Communications: "No conversations yet"

**Problem**: No SMS have been sent/received

**Solutions**:
1. **Send a test SMS** to your Twilio number
2. **Wait 5 seconds** for polling to update
3. **Check server logs** for `[Twilio]` entries
4. **Verify webhook** is configured correctly

---

## 📚 Additional Resources

### Documentation
- [Implementation Summary](docs/IMPLEMENTATION_SUMMARY.md) - Complete feature overview
- [Twilio SMS Setup](docs/TWILIO_SMS_SETUP.md) - Detailed SMS configuration
- [AI Conference Calling](docs/proposals/AI_CONFERENCE_CALLING_PROPOSAL.md) - Phase 2 roadmap
- [Cost Computation](docs/proposals/COST_COMPUTATION.md) - Pricing details

### API Endpoints

**Communications**:
- `GET /api/communications/conversations` - List SMS conversations
- `GET /api/communications/conversations/:phone/messages` - Message thread
- `POST /api/communications/sms/send` - Send SMS

**Twilio**:
- `POST /api/twilio/webhook/sms` - Incoming SMS webhook

### Environment Variables Reference

| Variable | Required | Purpose |
|----------|----------|---------|
| `DATABASE_URL` | ✅ | PostgreSQL connection |
| `GOOGLE_CLIENT_ID` | ✅ | OAuth login |
| `GOOGLE_CLIENT_SECRET` | ✅ | OAuth login |
| `GEMINI_API_KEY` | ✅ | AI responses |
| `TWILIO_ACCOUNT_SID` | ✅ (SMS) | Twilio auth |
| `TWILIO_AUTH_TOKEN` | ✅ (SMS) | Twilio auth |
| `TWILIO_PHONE_NUMBER` | ✅ (SMS) | Your Twilio number |
| `OWNER_PHONE_NUMBER` | ✅ (SMS) | Your personal phone |
| `HOME_DEV_MODE` | ⚠️ | Dev-only auth bypass |
| `ELEVENLABS_API_KEY` | ⚪ | Premium TTS |
| `OWNER_USER_ID` | ⚪ | Link SMS to user |

---

## 🎉 Success!

If you've made it here, you should have:
- ✅ Application running at http://localhost:5000
- ✅ Voice Lab generating AI text and speaking
- ✅ Sound Settings showing cost comparisons
- ✅ Communications hub ready for SMS
- ✅ SMS integration responding to texts

**Next Steps:**
1. Explore the AI chat interface
2. Try different voices and expressiveness styles
3. Send SMS commands to test owner authentication
4. Check cost optimization recommendations
5. Review Phase 2 proposals for conference calling

**Need Help?**
- Check [docs/IMPLEMENTATION_SUMMARY.md](docs/IMPLEMENTATION_SUMMARY.md) for feature details
- Review [docs/TWILIO_SMS_SETUP.md](docs/TWILIO_SMS_SETUP.md) for SMS troubleshooting
- Check server logs for detailed error messages

---

## 💡 Pro Tips

### Development Workflow

1. **Two terminals**: Backend (`npm run dev`) + Frontend (`npm run dev:client`)
2. **Hot reload**: Frontend auto-reloads on file changes
3. **Server logs**: Watch for `[Twilio]`, `[AI]`, `[Communications]` prefixes
4. **Browser console**: Check for client-side errors (F12)

### Testing SMS Without Phone

```bash
# Use Twilio Console to send test SMS
# Go to: https://console.twilio.com/develop/sms/try-it-out/send-an-sms
# To: Your Twilio phone number
# From: Any test number
# Body: "Test message"
```

### Cost Optimization

1. Start with **Low verbosity** ($0.09/month for 1K messages)
2. Use **Gemini Flash** (85% cheaper than Pro)
3. Enable **Mute mode** for text-only responses (free!)
4. Review costs at `/sound-settings`

### Recommended Voice Settings

**For testing**: Kore (Female, Calm, Professional)
**For energy**: Fenrir (Male, Energetic)
**For storytelling**: Aoede (Female, Soft, Storyteller)

---

**Happy coding!** 🚀

