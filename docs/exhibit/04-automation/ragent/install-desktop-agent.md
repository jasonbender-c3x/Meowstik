# Installing the Desktop Agent

> Full desktop control for AI collaboration

---

## Overview

The Meowstik Desktop Agent enables AI control of your entire computer:

- **Screen Capture** - Streams your desktop to the AI (1-2 FPS)
- **Mouse Control** - AI can click, drag, and scroll
- **Keyboard Control** - AI can type and use hotkeys
- **Cross-Platform** - Works on Windows, macOS, and Linux

Perfect for [Mode B: 2-Way Real-Time](./collaborative-editing.md#mode-b-2-way-real-time-full-desktop) collaboration.

---

## Requirements

| Requirement | Details |
|-------------|---------|
| **Node.js** | Version 18 or higher |
| **OS** | Windows 10+, macOS 10.15+, or Linux |
| **Network** | Internet connection to Meowstik server |
| **Build Tools** | Required for nut.js (see below) |

---

## Installation

### Option 1: NPM Global Install

```bash
npm install -g meowstik-agent
```

### Option 2: Run with npx (No Install)

```bash
npx meowstik-agent --token YOUR_TOKEN --server wss://your-app.replit.app
```

### Option 3: Download Installer

1. Go to [/collaborate](/collaborate) in Meowstik
2. Click "Download Desktop Agent"
3. Run the installer for your platform:
   - Windows: `meowstik-agent-setup.exe`
   - macOS: `meowstik-agent.dmg`
   - Linux: `meowstik-agent.AppImage`

---

## Build Tool Requirements

The agent uses `@nut-tree-fork/nut-js` for input injection, which requires native compilation.

### Windows

Install Visual C++ Build Tools from [Visual Studio Downloads](https://visualstudio.microsoft.com/downloads/).

### macOS

```bash
xcode-select --install
```

### Linux (Debian/Ubuntu)

```bash
# For Debian/Ubuntu-based systems
sudo apt-get install -y build-essential libxtst-dev libpng-dev
```

### Linux (Fedora/RHEL)

```bash
sudo dnf install libXtst-devel libpng-devel gcc-c++
```

---

## Getting Your Token

### For Production/Remote Servers

1. Open Meowstik in your browser
2. Go to [/collaborate](/collaborate)
3. Click "Start Desktop Session"
4. Copy the session token that appears

### For Local Development (Tokenless Mode)

When connecting to `localhost`, you can skip token generation entirely! See [Desktop Agent Localhost Development Mode](../desktop-agent-localhost-dev.md) for details.

```bash
# No token needed for localhost!
meowstik-agent --relay ws://localhost:5000/ws/desktop/agent/
```

---

## Running the Agent

### Local Development (No Token Required)

```bash
# Connect to local server without token
meowstik-agent --relay ws://localhost:5000/ws/desktop/agent/
```

**Note**: Tokenless connections only work for `localhost` or `127.0.0.1` in development mode (`NODE_ENV !== "production"`). See [Localhost Development Mode](../desktop-agent-localhost-dev.md).

### Production (Token Required)

```bash
meowstik-agent --token YOUR_TOKEN --relay wss://your-app.replit.app/ws/desktop
```

### With Options

```bash
meowstik-agent \
  --token YOUR_TOKEN \
  --relay wss://your-app.replit.app/ws/desktop \
  --fps 1 \
  --quality 50 \
  --no-audio
```

### All Options

| Option | Description | Default |
|--------|-------------|---------|
| `-t, --token` | Session token (optional for localhost) | - |
| `-r, --relay` | Server WebSocket URL | - |
| `-f, --fps` | Frames per second | 2 |
| `-q, --quality` | JPEG quality (1-100) | 60 |
| `--no-audio` | Disable audio capture | enabled |
| `--no-input` | Disable input injection | enabled |

---

## How It Works

```
1. CONNECT
   Agent connects to Meowstik server via WebSocket

2. CAPTURE
   Every 0.5-1 seconds, agent captures a screenshot

3. STREAM
   Screenshot is compressed and sent to server

4. ANALYZE
   Server sends image to Gemini Vision for analysis

5. COMMAND
   AI decides on action (click, type, etc.)

6. EXECUTE
   Agent receives command and injects input

7. LOOP
   Process repeats for real-time collaboration
```

---

## Security

| Protection | Description |
|------------|-------------|
| **Token Auth** | Only authenticated sessions can control |
| **Encrypted** | All traffic uses TLS/WSS |
| **No Storage** | Screenshots are never saved to disk |
| **Expiry** | Tokens expire on disconnect |
| **Kill Switch** | Press Escape 5 times to stop agent |

### Emergency Stop

If you need to immediately stop AI control:

1. **Press Escape 5 times quickly** - Agent stops all input
2. **Close terminal** - Kills the agent process
3. **Unplug network** - Disconnects from server

---

## Troubleshooting

### Agent Won't Start

```
Error: Cannot find module 'robotjs'
```

**Solution:** Install build tools (see above) and reinstall:

```bash
npm uninstall -g meowstik-agent
npm install -g meowstik-agent
```

### Connection Failed

```
Error: WebSocket connection failed
```

**Solution:**
1. Check your internet connection
2. Verify the server URL is correct
3. Ensure Meowstik is running
4. Check firewall settings

### No Screen Capture

```
Error: Failed to capture screen
```

**Solution:**
- **macOS:** Grant Screen Recording permission in System Preferences → Security & Privacy
- **Linux:** Install `scrot` or `gnome-screenshot`
- **Windows:** Run as Administrator

### Input Not Working

```
Warning: Input injection failed
```

**Solution:**
- **macOS:** Grant Accessibility permission in System Preferences
- **Linux:** Add user to `input` group: `sudo usermod -a -G input $USER`
- **Windows:** Run as Administrator

---

## Development Mode

Run from source for development:

```bash
git clone https://github.com/your-repo/meowstik-agent
cd meowstik-agent
npm install
npm run dev -- --token YOUR_TOKEN --server wss://localhost:5000
```

---

## Related Documentation

- [Browser & Computer Use](./browser-computer-use.md) - AI automation capabilities
- [Collaborative Editing](./collaborative-editing.md) - Voice-guided sessions
- [Installing the Browser Extension](./install-browser-extension.md) - Chrome extension
- [Ragent Index](./INDEX.md) - All agent documentation
