# Meowstik Local Development Guide

## Table of Contents
1. [Running Locally](#1-running-locally)
2. [Debugging TypeScript](#2-debugging-typescript)
3. [Where Are My Logs?](#3-where-are-my-logs)
4. [Roadmap: Local Database Backup](#4-roadmap-local-database-backup)
5. [Connecting to Databases](#5-connecting-to-databases)
6. [Secrets Management](#6-secrets-management)
7. [Bypassing Replit Login](#7-bypassing-replit-login)
8. [Required Stack for Local Dev](#8-required-stack-for-local-dev)
9. [Self-Hosting](#9-self-hosting)
10. [MCP Servers](#10-mcp-servers)
11. [Chrome DevTools (Port 9222)](#11-chrome-devtools-port-9222)
12. [Virtual Framebuffer & Streaming](#12-virtual-framebuffer--streaming)

---

## 1. Running Locally

### Prerequisites
- Node.js 20+ (`node --version`)
- PostgreSQL 15+ (local or Docker)
- npm or pnpm

### Step-by-Step

```bash
# 1. Clone the repository
git clone https://github.com/YOUR_ORG/meowstik.git
cd meowstik

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env
# Edit .env with your secrets (see Section 6)

# 4. Start PostgreSQL (choose one)
# Option A: Docker
docker run -d --name meowstik-db \
  -e POSTGRES_USER=meowstik \
  -e POSTGRES_PASSWORD=secret \
  -e POSTGRES_DB=meowstik \
  -p 5432:5432 \
  postgres:15

# Option B: Local PostgreSQL service
# Ensure PostgreSQL is running, create database manually

# 5. Set DATABASE_URL in .env
# DATABASE_URL=postgresql://meowstik:secret@localhost:5432/meowstik

# 6. Push database schema
npm run db:push

# 7. Start the development server
npm run dev
```

The app runs at `http://localhost:5000` with hot reload enabled.

---

## 2. Debugging TypeScript

### Running a Single TS File

```bash
# Using tsx (recommended - already in dependencies)
npx tsx path/to/file.ts

# Example: Test SSH implementation
npx tsx test-ssh-implementation.ts

# With environment variables
DATABASE_URL=... npx tsx server/services/some-service.ts
```

### VS Code Debug Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Debug Server",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npx",
      "runtimeArgs": ["tsx", "server/index.ts"],
      "env": {
        "NODE_ENV": "development"
      },
      "console": "integratedTerminal",
      "sourceMaps": true
    },
    {
      "name": "Debug Script",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npx",
      "runtimeArgs": ["tsx", "${file}"],
      "console": "integratedTerminal",
      "sourceMaps": true
    }
  ]
}
```

### Breakpoints
1. Open a `.ts` file in VS Code
2. Click the left margin to set breakpoints
3. Press F5 or use Run > Start Debugging
4. Execution pauses at breakpoints

### Console Output
- Server logs appear in terminal running `npm run dev`
- Use `console.log()`, `console.error()`, `console.table()` freely
- For structured output: `JSON.stringify(obj, null, 2)`

---

## 3. Where Are My Logs?

### Log Locations

| Log Type | Location | Description |
|----------|----------|-------------|
| Server Console | Terminal | Real-time Express server output |
| Memory Logs | `logs/` directory | Persistent AI memory files |
| RAG Debug | `/api/debug/rag/traces` | Retrieval pipeline traces |
| API Request Logs | Server console | Middleware logs each request |
| Browser Console | DevTools (F12) | Frontend errors and debug |
| Workflow Logs | `/tmp/logs/` | Replit-specific (not local) |

### Key Log Files in `logs/`

```
logs/
├── Short_Term_Memory.md   # Persistent AI memory
├── cache.md               # Thoughts for next turn
├── execution.md           # Execution traces
├── personal.md            # Personal notes
└── STM_APPEND.md          # Memory append buffer
```

### Viewing Logs

```bash
# Watch server logs
npm run dev 2>&1 | tee server.log

# Tail a specific log
tail -f logs/execution.md

# Search logs
grep -r "ERROR" logs/
```

### Adding Custom Logging

```typescript
// In server code
console.log('[MyService]', { action: 'doing thing', data });

// For important events - use the log_append tool pattern
import fs from 'fs';
fs.appendFileSync('logs/execution.md', `\n## ${new Date().toISOString()}\n${content}\n`);
```

---

## 4. Roadmap: Local Database Backup

### Goal
Add a feature that opens a directory chooser, gets write permissions, and saves a database copy locally.

### Implementation Steps

#### Phase 1: Backend Export Endpoint
```typescript
// server/routes/database-backup.ts
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

router.post('/api/database/export', async (req, res) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `meowstik-backup-${timestamp}.sql`;
  
  // pg_dump to temp file
  await execAsync(`pg_dump ${process.env.DATABASE_URL} > /tmp/${filename}`);
  
  res.download(`/tmp/${filename}`, filename);
});
```

#### Phase 2: Frontend Directory Chooser (Browser File System API)
```typescript
// client/src/components/database-backup.tsx
async function saveBackupLocally() {
  // Request directory access
  const dirHandle = await window.showDirectoryPicker({
    mode: 'readwrite'
  });
  
  // Fetch backup from server
  const response = await fetch('/api/database/export', { method: 'POST' });
  const blob = await response.blob();
  
  // Write to chosen directory
  const fileHandle = await dirHandle.getFileHandle(`backup-${Date.now()}.sql`, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(blob);
  await writable.close();
}
```

#### Phase 3: Electron Desktop App (Full Permissions)
For the `desktop-app/` Electron app:
```typescript
import { dialog } from 'electron';

async function chooseBackupDirectory() {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory']
  });
  return result.filePaths[0];
}
```

---

## 5. Connecting to Databases

### Local PostgreSQL

```bash
# .env
DATABASE_URL=postgresql://user:password@localhost:5432/meowstik
```

### Docker PostgreSQL

```yaml
# docker-compose.yml
version: '3.8'
services:
  db:
    image: postgres:15
    environment:
      POSTGRES_USER: meowstik
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: meowstik
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### Remote/Managed Databases

```bash
# Neon (used by Replit)
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/meowstik?sslmode=require

# Supabase
DATABASE_URL=postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres

# Railway
DATABASE_URL=postgresql://postgres:pass@containers-us-west-xxx.railway.app:5432/railway
```

### Schema Management

```bash
# Push schema changes (recommended)
npm run db:push

# Force push (use carefully)
npm run db:push --force

# Generate migration (optional)
npx drizzle-kit generate

# View database
npx drizzle-kit studio
```

---

## 6. Secrets Management

### Required Environment Variables

Create `.env` file (never commit this):

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/meowstik

# Google OAuth
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx

# Google Cloud TTS (path to service account JSON)
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Gemini AI
GEMINI_API_KEY=AIzaSy...

# Twilio (optional)
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_PHONE_NUMBER=+1234567890

# GitHub (optional)
GITHUB_TOKEN=ghp_xxx

# Session
SESSION_SECRET=your-random-32-char-string
```

### From Flat Key-Value File

If you have a file like `secrets.txt`:
```
GEMINI_API_KEY=AIzaSy...
TWILIO_ACCOUNT_SID=ACxxx
```

Convert it:
```bash
# Just rename/copy it
cp secrets.txt .env

# Or source it
source secrets.txt && npm run dev
```

### Google Cloud Service Account JSON

1. Keep the JSON file outside your repo:
   ```bash
   mkdir -p ~/.config/meowstik
   mv ai-stack-xxx.json ~/.config/meowstik/service-account.json
   ```

2. Reference in `.env`:
   ```bash
   GOOGLE_APPLICATION_CREDENTIALS=/home/youruser/.config/meowstik/service-account.json
   ```

3. Or embed as base64 (for containers):
   ```bash
   GOOGLE_CREDENTIALS_BASE64=$(base64 -w0 service-account.json)
   ```

### Using direnv (recommended)

```bash
# Install direnv
# Mac: brew install direnv
# Linux: apt install direnv

# Create .envrc
echo 'dotenv' > .envrc
direnv allow

# Now .env is auto-loaded when you cd into the project
```

---

## 7. Bypassing Replit Login

For local development, bypass the Replit OAuth:

### Option 1: Environment Flag

```bash
# .env
BYPASS_AUTH=true
```

Update auth middleware:
```typescript
// server/middleware/auth.ts
if (process.env.BYPASS_AUTH === 'true') {
  req.user = { id: 'local-dev', email: 'dev@localhost' };
  return next();
}
```

### Option 2: Local Session

```typescript
// server/routes/auth.ts
if (process.env.NODE_ENV === 'development' && process.env.BYPASS_AUTH) {
  router.get('/api/auth/user', (req, res) => {
    res.json({
      id: 'local-dev-user',
      email: 'developer@localhost',
      name: 'Local Developer'
    });
  });
}
```

### Option 3: Mock OAuth Flow

Create a local login page that sets session directly without external OAuth.

---

## 8. Required Stack for Local Dev

### System Requirements

| Component | Version | Installation |
|-----------|---------|--------------|
| Node.js | 20+ | `nvm install 20` |
| PostgreSQL | 15+ | `brew install postgresql` or Docker |
| Chromium | Latest | For Playwright tests |
| FFmpeg | 6+ | For audio processing |
| Git | 2.30+ | For version control |

### NPM Scripts Available

```bash
npm run dev        # Start full dev server (Express + Vite)
npm run build      # Build for production
npm run db:push    # Sync database schema
npm run db:studio  # Open Drizzle Studio
npm test           # Run tests
```

### Dockerfile Alternative to replit.nix

```dockerfile
FROM node:20-slim

# System dependencies (replaces replit.nix packages)
RUN apt-get update && apt-get install -y \
  chromium \
  xvfb \
  ffmpeg \
  libasound2 \
  libatk1.0-0 \
  libcups2 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  fonts-liberation \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

EXPOSE 5000
CMD ["npm", "start"]
```

### VS Code DevContainer

Create `.devcontainer/devcontainer.json`:

```json
{
  "name": "Meowstik Dev",
  "image": "mcr.microsoft.com/devcontainers/typescript-node:20",
  "features": {
    "ghcr.io/devcontainers/features/docker-in-docker:2": {},
    "ghcr.io/devcontainers/features/git:1": {}
  },
  "postCreateCommand": "npm install",
  "forwardPorts": [5000, 5432],
  "customizations": {
    "vscode": {
      "extensions": [
        "dbaeumer.vscode-eslint",
        "esbenp.prettier-vscode",
        "bradlc.vscode-tailwindcss"
      ]
    }
  }
}
```

---

## 9. Self-Hosting

### Docker Compose Production Stack

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://meowstik:secret@db:5432/meowstik
    env_file:
      - .env.production
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:15
    environment:
      POSTGRES_USER: meowstik
      POSTGRES_PASSWORD: secret
      POSTGRES_DB: meowstik
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  caddy:
    image: caddy:2
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
  caddy_data:
```

### Caddyfile (Auto HTTPS)

```
meowstik.yourdomain.com {
  reverse_proxy app:5000
}
```

### Deploy Commands

```bash
# Build and start
docker-compose -f docker-compose.prod.yml up -d --build

# View logs
docker-compose -f docker-compose.prod.yml logs -f app

# Update
git pull && docker-compose -f docker-compose.prod.yml up -d --build
```

---

## 10. MCP Servers

MCP (Model Context Protocol) servers provide tool access to AI models.

### Current MCP Integrations
- Notion (custom-mcp)
- Miro (custom-mcp)
- Figma (figma)

### Running MCP Locally

```bash
# The meowstik-agent package includes MCP support
cd packages/meowstik-agent
npm install
npm start
```

### Connecting MCP

```typescript
// WebSocket connection to MCP server
const ws = new WebSocket('ws://localhost:3001/mcp');

ws.onmessage = (event) => {
  const response = JSON.parse(event.data);
  // Handle MCP tool responses
};

// Send MCP request
ws.send(JSON.stringify({
  type: 'tool_call',
  tool: 'notion_search',
  params: { query: 'project notes' }
}));
```

### Environment Variables for MCP

```bash
# Notion MCP
NOTION_API_KEY=secret_xxx

# Miro MCP
MIRO_ACCESS_TOKEN=xxx

# Figma MCP
FIGMA_ACCESS_TOKEN=xxx
```

---

## 11. Chrome DevTools (Port 9222)

### Starting Chrome with Remote Debugging

```bash
# Headless Chrome with debugging
chromium --headless --remote-debugging-port=9222 --no-sandbox

# With a visible window
chromium --remote-debugging-port=9222 --no-first-run

# WSL2 specific
chromium --remote-debugging-port=9222 --disable-gpu --no-sandbox
```

### Connecting Playwright to Debug Port

```typescript
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9222');
const context = browser.contexts()[0];
const page = context.pages()[0];

// Now you can control the browser
await page.goto('https://example.com');
```

### DevTools GUI Connection

1. Open Chrome/Chromium on your machine
2. Navigate to `chrome://inspect`
3. Click "Configure..." and add `localhost:9222`
4. Your remote browser appears under "Remote Target"
5. Click "inspect" to open DevTools

### Security Warning
Never expose port 9222 to the internet - it allows full browser control.

---

## 12. Virtual Framebuffer & Streaming

### Xvfb Setup (Headless Display)

```bash
# Install
apt install xvfb x11vnc

# Start virtual display
Xvfb :99 -screen 0 1920x1080x24 &
export DISPLAY=:99

# Run graphical app
chromium --no-sandbox &

# Start VNC server for that display
x11vnc -display :99 -forever -shared -rfbport 5900 &
```

### Stream to Browser (noVNC)

```bash
# Install websockify
pip install websockify

# Bridge VNC to WebSocket
websockify --web /usr/share/novnc 6080 localhost:5900

# Access at http://localhost:6080/vnc.html
```

### FFmpeg Streaming

```bash
# Capture X11 display to WebRTC-compatible stream
ffmpeg -f x11grab -video_size 1920x1080 -i :99 \
  -c:v libx264 -preset ultrafast -tune zerolatency \
  -f mpegts udp://localhost:1234

# Or to file
ffmpeg -f x11grab -video_size 1920x1080 -i :99 -t 60 output.mp4
```

### Docker with Xvfb

```dockerfile
FROM node:20-slim

RUN apt-get update && apt-get install -y \
  xvfb \
  chromium \
  x11vnc \
  && rm -rf /var/lib/apt/lists/*

# Wrapper script to start Xvfb before app
COPY start.sh /start.sh
RUN chmod +x /start.sh

CMD ["/start.sh"]
```

```bash
# start.sh
#!/bin/bash
Xvfb :99 -screen 0 1920x1080x24 &
export DISPLAY=:99
exec npm start
```

### Chromecast/Screen Sharing Integration

For casting to Chromecast:
1. Use a WebRTC server (e.g., Janus, mediasoup)
2. Capture desktop with FFmpeg or browser `getDisplayMedia()`
3. Stream to cast-enabled devices

```typescript
// Browser-side screen capture
const stream = await navigator.mediaDevices.getDisplayMedia({
  video: { width: 1920, height: 1080 }
});

// Send to WebRTC peer or server
```

---

## Quick Reference Card

```bash
# Start dev server
npm run dev

# Run a TypeScript file
npx tsx path/to/file.ts

# Debug in VS Code
F5 (with launch.json configured)

# View database
npx drizzle-kit studio

# Check logs
tail -f logs/execution.md

# Export database
pg_dump $DATABASE_URL > backup.sql

# Start headless browser
chromium --headless --remote-debugging-port=9222

# Virtual display
Xvfb :99 -screen 0 1920x1080x24 & export DISPLAY=:99
```
