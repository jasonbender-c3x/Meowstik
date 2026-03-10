# 📋 Quick Command Reference

Essential commands for running and managing Meowstik.

---

## 🚀 Starting the Application

### Development Mode (Recommended)

**Terminal 1 - Backend:**
```bash
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev:client
```

**Or use the startup script:**
```bash
./start.sh
```

### Production Mode

```bash
npm run build && npm start
```

---

## 📦 Setup Commands

### First Time Setup
```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Then edit .env with your credentials

# Create database
createdb meowstik

# Run migrations
npm run db:push
```

### Update Dependencies
```bash
npm install
```

---

## 🗄️ Database Commands

```bash
# Push schema changes to database
npm run db:push

# Export database (backup)
npm run db:export

# Import database (restore)
npm run db:import

# Run migrations
npm run db:migrate

# Seed agent data
npm run seed:agents
```

---

## 🧪 Testing Commands

```bash
# Test TTS authentication
npm run test:tts-auth

# Test home dev mode
npm run test:home-dev

# Test hardware integration
npm run test:hardware

# Test hybrid search
npm run test:hybrid-search

# Diagnose TTS IAM issues
npm run diagnose:tts-iam
```

---

## 🔨 Build Commands

```bash
# Build main application
npm run build

# Build browser extension
npm run build:ext

# Type check
npm run check
```

---

## 🌐 Access URLs

Once started, access the app at:

- **Main App**: http://localhost:5000
- **Voice Lab**: http://localhost:5000/voice-lab
- **Sound Settings**: http://localhost:5000/sound-settings
- **Communications**: http://localhost:5000/communications
- **Live Voice Mode**: http://localhost:5000/live

---

## 🔧 Common Workflows

### After Pulling Latest Code
```bash
npm install          # Update dependencies
npm run db:push      # Update database schema
npm run dev          # Start backend
npm run dev:client   # Start frontend (in another terminal)
```

### Creating a Production Build
```bash
npm run build        # Build optimized version
npm start            # Run production server
```

### Testing SMS Integration
```bash
# 1. Start servers
npm run dev
npm run dev:client

# 2. Start ngrok (in another terminal)
ngrok http 5000

# 3. Configure Twilio webhook with ngrok URL
# https://YOUR-NGROK-URL.ngrok.io/api/twilio/webhook/sms

# 4. Send SMS to your Twilio number
# AI will respond!
```

### Resetting Database
```bash
# Export first (backup)
npm run db:export

# Drop and recreate
dropdb meowstik
createdb meowstik

# Push schema
npm run db:push

# Reseed agents (optional)
npm run seed:agents
```

---

## 📝 Environment Variables

### Quick Check
```bash
# View all env vars (be careful with sensitive data)
cat .env

# Check specific variable
grep GEMINI_API_KEY .env
grep DATABASE_URL .env
grep TWILIO .env
```

### Required for Core Features
```env
DATABASE_URL=postgresql://...
GEMINI_API_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

### Required for SMS Features
```env
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=+15551234567
OWNER_PHONE_NUMBER=+15551234567
```

### Optional Dev Mode (Skip Login)
```env
HOME_DEV_MODE=true
HOME_DEV_EMAIL=your-email@example.com
```

---

## 🐛 Debugging

### View Logs
```bash
# Backend logs appear in terminal running 'npm run dev'
# Look for:
# [Server] - General server messages
# [Twilio] - SMS webhook processing
# [AI] - Gemini API interactions
# [Communications] - API route handling
```

### Check Build Output
```bash
npm run check  # Type checking
```

### Test API Endpoints
```bash
# List conversations
curl http://localhost:5000/api/communications/conversations

# Check server health
curl http://localhost:5000/api/status
```

---

## 🎯 Feature-Specific Commands

### Voice Lab Testing
```bash
# No special commands - just navigate to:
# http://localhost:5000/voice-lab
```

### SMS Testing
```bash
# Send test SMS via Twilio Console
# Or text your Twilio number from your phone
# Watch backend logs for processing
```

### Cost Analysis
```bash
# Navigate to:
# http://localhost:5000/sound-settings
# Adjust sliders to see cost calculations
```

---

## 📚 Documentation

```bash
# Read startup guide
cat QUICK_START.md

# Read implementation summary
cat docs/IMPLEMENTATION_SUMMARY.md

# Read Twilio setup
cat docs/TWILIO_SMS_SETUP.md

# Read cost details
cat docs/proposals/COST_COMPUTATION.md
```

---

## ⚡ One-Liner Shortcuts

```bash
# Full setup from scratch
npm install && cp .env.example .env && echo "Now edit .env with your credentials"

# Start dev mode (backend only, add frontend in another terminal)
npm run dev

# Full dev environment
# Terminal 1:
npm run dev
# Terminal 2:
npm run dev:client

# Quick build and run
npm run build && npm start

# Check everything works
npm run check && npm run build

# Database reset
dropdb meowstik && createdb meowstik && npm run db:push
```

---

## 🆘 Getting Help

1. **Read QUICK_START.md** for detailed setup
2. **Check docs/IMPLEMENTATION_SUMMARY.md** for feature overview
3. **Review .env.example** for all available settings
4. **Check server logs** for error messages
5. **Browser console (F12)** for frontend errors

---

**Happy building!** 🚀
