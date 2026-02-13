# Meowstik Desktop Agent

Desktop agent for Meowstik AI collaboration. Enables real-time screen sharing and AI-controlled input injection.

## Installation

```bash
npm install -g meowstik-agent
```

Or run directly with npx:

```bash
npx meowstik-agent --token YOUR_SESSION_TOKEN --server wss://your-app.replit.app
```

## Usage

### Local Development (Tokenless Mode) ⭐ NEW

When connecting to `localhost` in development, no token is required:

```bash
# Connect to local server without token
npm run dev -- --relay ws://localhost:5000

# Or using the built package
meowstik-agent --relay ws://localhost:5000
```

**Requirements for tokenless mode:**
- Server URL must contain `localhost` or `127.0.0.1`
- Server must be running in development mode (`NODE_ENV !== "production"`)

**Note:** The `--relay` flag is an alias for `--server`. Both work identically.

See [Localhost Development Mode](../../docs/desktop-agent-localhost-dev.md) for details.

### Production (Token Required)

1. Create a desktop session in the Meowstik web app
2. Copy the session token
3. Run the agent:

```bash
meowstik-agent --token YOUR_TOKEN --relay wss://your-app.replit.app
```

## Options

| Option | Aliases | Description | Default |
|--------|---------|-------------|---------|
| `-t, --token` | - | Session token (optional for localhost) | - |
| `-s, --server` | `-r, --relay` | Server WebSocket URL | `ws://localhost:5000` |
| `-f, --fps` | - | Screen capture frames per second | 2 |
| `-q, --quality` | - | JPEG quality (1-100) | 60 |
| `--no-audio` | - | Disable audio capture | enabled |
| `--no-input` | - | Disable input injection | enabled |

**Examples:**

```bash
# Local development (no token needed)
meowstik-agent --server ws://localhost:5000

# Production with token
meowstik-agent --token abc123 --relay wss://myapp.com

# Custom FPS and quality
meowstik-agent --relay ws://localhost:5000 --fps 5 --quality 80

# View-only mode (no input injection)
meowstik-agent --token abc123 --server wss://myapp.com --no-input
```

## Features

- Real-time screen capture and streaming
- Mouse movement, clicks, and scrolling
- Keyboard input injection
- Automatic reconnection on disconnect
- Cross-platform support (Windows, macOS, Linux)

## Requirements

- Node.js 18+
- Native build tools for nut.js (input injection)

### Installing nut.js Dependencies

The agent uses `@nut-tree-fork/nut-js` for input injection, which requires native compilation. Installation requirements by platform:

**Windows:**
```bash
# Install Visual C++ Build Tools
# Download and install from: https://visualstudio.microsoft.com/downloads/
# Then install dependencies:
pnpm install
```

**macOS:**
```bash
xcode-select --install
pnpm install
```

**Linux:**
```bash
# For Debian/Ubuntu-based systems
sudo apt-get install -y build-essential libxtst-dev libpng-dev
pnpm install
```

**Note:** The nut.js library is a modern, actively maintained alternative to robotjs with better cross-platform support and no optional dependency issues.

## Security

- The agent only accepts input commands from the authenticated server
- Screen data is encrypted in transit via WebSocket
- Session tokens expire after disconnection
- No data is stored locally

## Development

```bash
# Clone and install
git clone https://github.com/your-repo/meowstik-agent
cd meowstik-agent
npm install

# Run in development
npm run dev -- --token YOUR_TOKEN --server wss://localhost:5000

# Build
npm run build
```
