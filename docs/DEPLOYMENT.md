# Deployment

How to run Meowstik in different environments.

---

## Local Development

### Prerequisites

- Node.js 20+
- pnpm 9+ (`npm i -g pnpm`)

### Steps

```bash
git clone https://github.com/jasonbender-c3x/Meowstik.git
cd Meowstik
pnpm install
cp .env.example .env   # edit with your keys
pnpm run dev
```

The dev server runs on `http://localhost:5000`.

Vite hot-reloads the React client automatically. The Express server restarts via `tsx --watch`.

> In day-to-day use, treat this as a **local Meowstik runtime**. The repo still has internal UI/backend splits for development, but you are not expected to think in terms of a separate client and server install.

---

## Environment Variables

### Core (Required)

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google AI Studio API key |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL |
| `SESSION_SECRET` | Express session signing secret (any random string) |

### Voice / TTS

| Variable | Description |
|----------|-------------|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service account JSON for Cloud TTS (recommended) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account key file (alternative) |

### Twilio

| Variable | Description |
|----------|-------------|
| `TWILIO_ACCOUNT_SID` | Twilio Account SID |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token |
| `TWILIO_PHONE_NUMBER` | Your Twilio phone number (E.164 format) |

### Search

| Variable | Description |
|----------|-------------|
| `EXA_API_KEY` | Exa neural search API key |
| `GOOGLE_SEARCH_API_KEY` | Google Custom Search API key |
| `GOOGLE_SEARCH_ENGINE_ID` | Google Custom Search Engine ID |

### GitHub / Evolution Engine

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub PAT (or configure via OAuth in UI) |

### Computer Use / Relay

| Variable | Description |
|----------|-------------|
| `ENABLE_DESKTOP_AGENT` | `true` to enable the optional desktop-relay WebSocket endpoint |
| `COMPUTER_USE_MODEL` | Override the Gemini Computer Use model (default: `gemini-3-flash-preview-exp`) |

### Browser Automation

| Variable | Description |
|----------|-------------|
| `CUSTOM_BROWSER_WS_ENDPOINT` | Custom Puppeteer WS endpoint |
| `CUSTOM_BROWSER_AUTH_TOKEN` | Auth token for custom browser |

### MCP

MCP server credentials depend on the servers you connect. Meowstik itself does not require global MCP env vars; configure each MCP server from Settings or via the app's MCP routes.

### Misc

| Variable | Description |
|----------|-------------|
| `PORT` | HTTP server port (default: `5000`) |
| `NODE_ENV` | `development` or `production` |
| `HOME_DEV_MODE` | Enable home dev mode features |

---

## Replit

1. Fork/import the repo to Replit
2. Go to **Tools → Secrets** and add your environment variables
3. Set `GOOGLE_REDIRECT_URI` to: `https://{your-repl-slug}.{your-username}.repl.co/api/auth/google/callback`
4. Click **Run**

Replit auto-installs dependencies via `pnpm install`.

The app is served on the Replit-provided domain automatically.

---

## Production (Self-Hosted)

```bash
# Build
pnpm run build

# Start
NODE_ENV=production node dist/index.js
```

Or use PM2 for process management:

```bash
npm i -g pm2
pm2 start dist/index.js --name meowstik
pm2 save
pm2 startup
```

### Nginx Reverse Proxy (optional)

```nginx
server {
    listen 80;
    server_name meowstik.yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        # Required for SSE
        proxy_buffering off;
        proxy_read_timeout 86400;
    }
}
```

**Important:** `proxy_buffering off` is required for SSE (streaming chat responses) to work correctly.

---

## Database

Meowstik uses **SQLite** (`better-sqlite3`). The database file is auto-created at startup.

- Default location: `./data/meowstik.db` (relative to project root)
- Managed via Drizzle ORM with migrations in `migrations/`

### Running Migrations

```bash
pnpm drizzle-kit push
```

### Resetting the Database

```bash
rm data/*.db
pnpm run dev  # auto-recreates on startup
```

---

## Health Checks

```bash
# Server status
curl http://localhost:5000/api/auth/user

# LLM usage stats
curl http://localhost:5000/api/llm/usage

# Database tables
curl http://localhost:5000/api/debug/database
```
