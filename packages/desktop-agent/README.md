# Meowstik Desktop Agent

**Full desktop remote control agent** for Meowstik AI collaboration.

This package provides **complete desktop automation** capabilities:
- 🖥️ **Real-time screen capture** - Streams your desktop screen to the AI
- 🖱️ **Mouse control** - AI can move cursor, click, and scroll
- ⌨️ **Keyboard input** - AI can type and trigger keyboard shortcuts
- 🔄 **Bidirectional control** - Enables true AI-directed desktop interaction

**Not to be confused with the browser extension** (`packages/extension`), which only automates browser tasks. This agent controls your **entire desktop**.

## Installation

```bash
npm install -g @meowstik/desktop-agent
```

Or run directly with npx:

```bash
npx @meowstik/desktop-agent --token YOUR_SESSION_TOKEN --server wss://your-app.replit.app
```

## Usage

### Local Development (Tokenless Mode)

When connecting to `localhost` in development, no token is required:

```bash
# Connect to local server without token
meowstik-desktop-agent --relay ws://localhost:5000/ws/desktop/agent/
```

**Requirements for tokenless mode:**
- Relay URL must contain `localhost` or `127.0.0.1`
- Server must be running in development mode (`NODE_ENV !== "production"`)

See [Localhost Development Mode](../../docs/desktop-agent-localhost-dev.md) for details.

### Production (Token Required)

1. Create a desktop session in the Meowstik web app
2. Copy the session token
3. Run the agent:

```bash
meowstik-desktop-agent --token YOUR_TOKEN --relay wss://your-app.replit.app/ws/desktop
```

## Options

| Option | Description | Default |
|--------|-------------|---------|
| `-t, --token` | Session token (optional for localhost) | - |
| `-r, --relay` | Server WebSocket URL | - |
| `-f, --fps` | Screen capture frames per second | 2 |
| `-q, --quality` | JPEG quality (1-100) | 60 |
| `--no-audio` | Disable audio capture | enabled |
| `--no-input` | Disable input injection | enabled |

## Features

- Real-time screen capture and streaming
- Mouse movement, clicks, and scrolling
- Keyboard input injection
- Automatic reconnection on disconnect
- Cross-platform support (Windows, macOS, Linux)

## Requirements

- Node.js 18+
- For input injection: Native build tools for robotjs

### Installing robotjs dependencies

**Windows:**
```bash
npm install --global windows-build-tools
```

**macOS:**
```bash
xcode-select --install
```

**Linux:**
```bash
sudo apt-get install libxtst-dev libpng++-dev
```

## Security

- The agent only accepts input commands from the authenticated server
- Screen data is encrypted in transit via WebSocket
- Session tokens expire after disconnection
- No data is stored locally

## Development

```bash
# Clone and install
git clone https://github.com/your-repo/meowstik
cd packages/desktop-agent
npm install

# Run in development
npm run dev -- --token YOUR_TOKEN --server wss://localhost:5000

# Build
npm run build
```
