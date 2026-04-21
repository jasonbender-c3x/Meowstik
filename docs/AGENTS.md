# Agents

For most current local installs, Meowstik's primary computer-use path is the **local runtime** (`desktop-service.ts` + `computer-use.ts`) rather than a separately managed desktop client.

This document now focuses on the **optional relay/extension pieces** that still exist in the codebase.

---

## Optional Desktop Relay

**Server:** `server/websocket-desktop.ts`

The desktop relay system streams screen frames and routes input over WebSocket for advanced or legacy setups where local computer use is being proxied instead of executed directly on the same machine.

### Architecture

```
User's Computer                     Meowstik Server
───────────────                     ───────────────
Desktop Agent ──── /ws/desktop/agent/:sessionId ────► Desktop Relay Service
                                                              │
Browser Viewer ◄── /ws/desktop/browser/:sessionId ───────────┘
```

Two client types connect to the same session:

| Client | Endpoint | Role |
|--------|----------|------|
| **Desktop Agent** | `/ws/desktop/agent/:sessionId` | Streams screen + audio; receives mouse/keyboard events |
| **Browser Viewer** | `/ws/desktop/browser/:sessionId` | Receives screen frames; optionally sends input |

### Relay Service

`server/services/desktop-relay-service.ts` manages sessions: pairing agents with viewers, relaying frames at the right rate, and enforcing access control.

### Computer Use Tools

Once a relay session is active, the AI can use the `computer_*` tools:

```
computer_screenshot  → capture current screen
computer_click       → click at (x, y)
computer_type        → type text
computer_key         → press a key combo
computer_scroll      → scroll up/down/left/right
computer_move        → move mouse
computer_wait        → wait N milliseconds
```

**Workflow:** `computer_screenshot` → analyze what's visible → `computer_click` or `computer_type` to interact.

### How to Connect the Optional Desktop Relay

1. The desktop-side client connects to:
   ```
   wss://your-server-host/ws/desktop/agent/{sessionId}?token={auth_token}
   ```
2. It streams compressed screenshots at ~1–5 fps
3. It receives back mouse/keyboard event messages to execute locally

> **Note:** This is not the primary local-install path anymore. It remains useful for relay scenarios, remote viewing, or compatibility with older workflows.

---

## Browser Extension

**Location:** `browser-extension/`

A Chrome/Chromium extension that embeds a Meowstik chat panel directly in the browser.

### Features

- **Chat interface** — Talk to Meowstik AI from any page
- **Live voice** — WebSocket-streamed real-time voice conversations
- **Screen capture** — Capture visible area, full page, or selected element
- **Page analysis** — Extract and analyze page content, links, forms
- **Browser automation** — AI can navigate, click, type, fill forms
- **Dev tools bridge** — Capture console logs and network traffic for AI debugging

### Installation (from source)

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `browser-extension/` directory

### Configuration

1. Click the extension icon
2. Go to **Settings** tab
3. Enter your Meowstik runtime URL, e.g. `ws://localhost:5000` for local dev or your deployed URL
4. Click **Connect**

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+M` / `Cmd+Shift+M` | Open popup |
| `Ctrl+Shift+V` | Start voice conversation |
| `Ctrl+Shift+S` | Quick screen capture |

### Directory Layout

```
browser-extension/
├── manifest.json      # Chrome extension manifest (MV3)
├── background/        # Service worker
├── content/           # Content scripts (injected into pages)
├── side_panel/        # The main chat side panel UI
└── icons/             # Extension icons
```

---

## Agent Authentication

Both the desktop relay and browser extension authenticate using session tokens issued by the Meowstik runtime. Tokens are validated on every WebSocket upgrade request.

The server enforces that agents can only access sessions they're authorized for.
