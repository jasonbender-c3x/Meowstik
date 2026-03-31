# Quick Start

Get Meowstik running locally in under 5 minutes.

---

## Prerequisites

- Node.js 20+
- `pnpm` (or `npm`)
- A Google account (for OAuth + Gemini API)

---

## 1. Clone & Install

```bash
git clone https://github.com/jasonbender-c3x/Meowstik.git
cd Meowstik
pnpm install
```

---

## 2. Set Environment Variables

Create a `.env` file in the repo root. The minimum required variables to get chat working:

```env
# Required — get from https://aistudio.google.com/app/apikey
GEMINI_API_KEY=your_gemini_api_key

# Required — get from https://console.cloud.google.com/apis/credentials
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/auth/google/callback

# Optional but recommended
SESSION_SECRET=any_random_string_32chars
PORT=5000
```

### Optional — for specific features

```env
# Google Cloud TTS (Chirp3-HD voices) — recommended for voice
GOOGLE_SERVICE_ACCOUNT_JSON={"type":"service_account",...}

# Twilio SMS & Voice
TWILIO_ACCOUNT_SID=ACxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+15551234567

# ElevenLabs (fallback TTS)
ELEVENLABS_API_KEY=your_key

# Web Search
EXA_API_KEY=your_exa_key
GOOGLE_SEARCH_API_KEY=your_key
GOOGLE_SEARCH_ENGINE_ID=your_engine_id

# GitHub (for Evolution Engine PRs)
# Configured via OAuth in the UI, or:
GITHUB_TOKEN=ghp_your_token
```

---

## 3. Run the Dev Server

```bash
pnpm run dev
```

This starts:
- **Server** on `http://localhost:5000` (Express + API)
- **Client** on `http://localhost:5173` (Vite dev server, proxied through Express)

Open `http://localhost:5000` in your browser.

---

## 4. First Run

1. Click **Sign in with Google**
2. You'll land on the main chat interface
3. Start a conversation — type anything!
4. Try asking: *"Search the web for the latest news about AI"*

---

## 5. Enable Voice

To hear TTS responses:

1. Click the **voice icon** in the chat header
2. Select a Chirp3-HD voice (default: **Kore**)
3. The AI will speak its responses aloud

For the best experience, set up a Google Cloud service account with the Text-to-Speech API enabled and provide `GOOGLE_SERVICE_ACCOUNT_JSON`.

---

## Replit Deployment

If you're on Replit, all dependencies auto-install. Add your secrets via **Tools → Secrets**:

```
GEMINI_API_KEY       → your key
GOOGLE_CLIENT_ID     → your OAuth client ID
GOOGLE_CLIENT_SECRET → your OAuth client secret
GOOGLE_REDIRECT_URI  → https://your-repl-name.your-username.repl.co/api/auth/google/callback
```

Then click **Run**.

---

## Verify It's Working

```bash
# Health check
curl http://localhost:5000/api/auth/user
# → {"id": null} if not logged in, or user object if logged in

# Create a test chat
curl -X POST http://localhost:5000/api/chats \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Chat"}'
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `GEMINI_API_KEY not set` | Add the key to `.env` |
| OAuth redirect mismatch | Check `GOOGLE_REDIRECT_URI` matches exactly what's in Google Cloud Console |
| TTS not working | Verify `GOOGLE_SERVICE_ACCOUNT_JSON` is valid JSON, or use OAuth fallback |
| SQLite error on startup | Delete `data/*.db` and restart — DB auto-recreates |
| Port 5000 in use | Set `PORT=5001` in `.env` |
