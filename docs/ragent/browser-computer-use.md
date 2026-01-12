# Browser & Computer Use (Project Ghost)

> AI-controlled browser automation and full desktop control powered by Gemini 2.5/3.0 Computer Use API

---

## Overview

Meowstik provides two levels of computer control with hands-free voice operation:

1. **Browser Use** - AI controls a headless browser via Playwright
2. **Computer Use (Project Ghost)** - AI controls the entire desktop using official Gemini Computer Use API

Both can be used with [Collaborative Editing](./collaborative-editing.md) for real-time voice-guided sessions.

---

## Project Ghost: Hands-Free Computer Use

**Project Ghost** is Meowstik's implementation of the official Gemini Computer Use API, enabling true hands-free desktop control through voice commands.

### Key Features

- 🎤 **Voice-Driven**: Control your computer entirely through speech
- 👁️ **Vision Analysis**: Gemini sees your screen in real-time
- 🎥 **Video Streaming**: Gemini 3.0 supports continuous 1 FPS video input
- 🤖 **Intelligent Actions**: AI plans and executes multi-step tasks
- 🔒 **Safety First**: Confirmation required for destructive operations
- ♿ **Accessibility**: Perfect for users with limited mobility
- 🧪 **Visual Testing**: Automated UI testing without API access

### Model Support

| Model | Audio | Vision | Video Streaming | Computer Use |
|-------|-------|--------|----------------|--------------|
| Gemini 2.5 Flash | ✅ Real-time | ✅ Screenshots | ❌ | ✅ |
| Gemini 3.0 Flash | ✅ Real-time | ✅ Screenshots | ✅ 1 FPS JPEG | ✅ |

**Environment Variables:**
- `COMPUTER_USE_MODEL` - Set model: `gemini-2.0-flash-exp`, `gemini-2.5-flash`, or `gemini-3.0-flash-preview`

### How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. Voice Input                                                   │
│    User: "Go to Google, search for latest lol cats video"      │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2. Gemini Live API (with Computer Use tools enabled)           │
│    - Processes voice → text                                     │
│    - Analyzes screen via vision                                 │
│    - Decides which Computer Use function to call                │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3. Function Call Execution                                      │
│    computer_click(x=500, y=300)                                 │
│    computer_type(text="lol cats video")                         │
│    computer_key(key="Enter")                                    │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4. Desktop Agent                                                │
│    - Receives commands via WebSocket                            │
│    - Executes mouse/keyboard actions                            │
│    - Streams screen frames back to AI                           │
└──────────────────────────┬──────────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5. Continuous Loop                                              │
│    - AI sees result of action                                   │
│    - Decides next step or reports completion                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## Browser Use (Playwright)

### How It Works

| Step | Description |
|------|-------------|
| 1. Session Start | AI spawns a Playwright browser instance |
| 2. Navigation | AI navigates to URLs, clicks, types |
| 3. Vision | Screenshots sent to Gemini Vision for analysis |
| 4. Decision | AI decides next action based on visual analysis |
| 5. Execution | Playwright executes the action |
| 6. Loop | Repeat until task complete |

### Available Actions

| Action | Description | Example |
|--------|-------------|---------|
| `navigate` | Go to a URL | `{ url: "https://example.com" }` |
| `click` | Click an element | `{ selector: "#submit-btn" }` |
| `type` | Type text into an input | `{ selector: "input", text: "hello" }` |
| `screenshot` | Capture current state | Returns base64 image |
| `wait` | Wait for element | `{ selector: ".loading", state: "hidden" }` |
| `getText` | Extract text content | `{ selector: ".title" }` |
| `evaluate` | Run JavaScript | `{ script: "document.title" }` |
| `scroll` | Scroll the page | `{ direction: "down", amount: 500 }` |

### Pages

| Page | Route | Description |
|------|-------|-------------|
| [Browser](/browser) | `/browser` | Full browser control with Browserbase |
| [Collaborate](/collaborate) | `/collaborate` | AI collaboration hub |

### API Endpoints

```
POST /api/playwright/navigate   - Navigate to URL
POST /api/playwright/click      - Click element
POST /api/playwright/type       - Type text
POST /api/playwright/screenshot - Capture screenshot
POST /api/playwright/wait       - Wait for element
POST /api/playwright/getText    - Get element text
POST /api/playwright/evaluate   - Execute JavaScript
```

### Integration with Voice

When used with [Mode B (2-Way Real-Time)](./collaborative-editing.md#mode-b-2-way-real-time-full-desktop):

```
User: "Go to GitHub and find my repositories"
AI: [navigates to github.com, analyzes page, clicks profile, finds repos]
AI: "I found 15 repositories. Which one would you like to open?"
```

---

## Computer Use (Full Desktop) - Project Ghost

### Official Gemini 2.5 Computer Use API

Project Ghost uses the **official Gemini 2.5 Computer Use model** with built-in desktop control capabilities. Instead of manually analyzing screenshots and planning actions, Gemini's native model understands desktop interfaces and can directly issue computer control commands.

### Available Computer Use Functions

These are the official Gemini Computer Use function declarations available in Project Ghost:

| Function | Description | Parameters |
|----------|-------------|------------|
| `computer_click` | Click at coordinates | `{ x: number, y: number, button?: "left"\|"right"\|"middle" }` |
| `computer_type` | Type text | `{ text: string }` |
| `computer_key` | Press keyboard key | `{ key: string, modifiers?: string[] }` |
| `computer_scroll` | Scroll screen | `{ direction: "up"\|"down"\|"left"\|"right", amount?: number }` |
| `computer_move` | Move mouse cursor | `{ x: number, y: number }` |
| `computer_screenshot` | Take screenshot | `{ fullScreen?: boolean }` |
| `computer_wait` | Wait before next action | `{ delay: number }` |

### Keyboard Keys Supported

- **Navigation**: `Enter`, `Tab`, `Escape`, `Backspace`, `Delete`
- **Arrows**: `ArrowUp`, `ArrowDown`, `ArrowLeft`, `ArrowRight`
- **Special**: `Home`, `End`, `PageUp`, `PageDown`
- **Modifiers**: `Control`, `Shift`, `Alt`, `Meta`

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     USER'S COMPUTER                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────┐     ┌────────────────────────────┐  │
│  │   Desktop Agent    │     │      Any Application       │  │
│  │   (meowstik-agent) │     │  (Browser, Office, etc)    │  │
│  └─────────┬──────────┘     └────────────────────────────┘  │
│            │                           ▲                     │
│            │ Streams Screen Frames     │ Executes Actions    │
│            │ (WebSocket)               │ (mouse/keyboard)    │
│            ▼                           │                     │
│  ┌─────────────────────────────────────┴───────────────────┐ │
│  │          Desktop Relay Service (Meowstik Server)        │ │
│  └─────────────────────────────────────────────────────────┘ │
│                          │                                   │
└──────────────────────────┼───────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  GEMINI 2.5 COMPUTER USE API                 │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────┐     ┌──────────────┐     ┌───────────┐  │
│  │  Gemini Live   │────►│Vision Analysis│────►│ Function  │  │
│  │  Voice Session │     │ + Reasoning   │     │ Calling   │  │
│  └────────────────┘     └──────────────┘     └───────────┘  │
│                                                              │
│  Returns: computer_click, computer_type, etc. function calls │
└─────────────────────────────────────────────────────────────┘
```
| `typeString` | Type a string | `{ text }` |
| `keyDown` / `keyUp` | Hold/release key | `{ key }` |

### Use Cases

| Use Case | Description |
|----------|-------------|
| **Any Application** | Control Photoshop, Excel, VS Code, anything |
| **Gaming** | AI plays games with vision feedback |
| **Accessibility** | Hands-free computer control for disabled users |
| **Automation** | Automate complex multi-app workflows |
| **Remote Assistance** | AI helps troubleshoot your computer |

### Use Cases

| Use Case | Description | Voice Command Example |
|----------|-------------|----------------------|
| **General Navigation** | Browse websites, open apps | "Go to Gmail and check my inbox" |
| **Productivity** | Work with Office apps, spreadsheets | "Open Excel, create a new budget spreadsheet" |
| **Gaming** | AI plays games with vision feedback | "Play this level and complete the objectives" |
| **Accessibility** | Hands-free computer control | "Click the submit button at the bottom" |
| **Automation** | Automate complex workflows | "Fill out this form with my information" |
| **Visual Testing** | Test applications without API | "Test the checkout flow on this website" |

---

## API Endpoints (Project Ghost)

### Computer Use HTTP Endpoints

```
POST /api/computer-use/plan-with-gemini
  Body: { goal, screenshot, url?, title?, conversationHistory? }
  Response: { actions, reasoning, requiresConfirmation }

POST /api/computer-use/execute-desktop
  Body: { action, sessionId }
  Response: { success, message, action }

POST /api/computer-use/run-desktop-task
  Body: { goal, sessionId, maxSteps? }
  Response: { started, goal, message, sessionId }
  
POST /api/computer-use/analyze
  Body: { screenshot, context? }
  Response: { description, elements, suggestedActions }

POST /api/computer-use/assess
  Body: { goal, screenshot, actions? }
  Response: { complete, progress, nextSteps? }

GET /api/computer-use/history?limit=10
  Response: { actions: [...] }
```

### WebSocket Integration

**Gemini Live with Computer Use:**

```typescript
// 1. Create a Live session with Computer Use enabled
POST /api/live/create
Body: { enableComputerUse: true, desktopSessionId: "..." }

// 2. Connect to WebSocket
WS: /api/live/stream/{sessionId}

// 3. Link to desktop session
Send: { type: "linkDesktop", desktopSessionId: "session-123" }

// 4. Speak or send text
Send: { type: "audio", data: "<base64-pcm>", mimeType: "audio/pcm" }
Send: { type: "text", text: "Open Chrome and search for cats" }

// 5. Receive function calls and execution updates
Receive: { type: "functionCall", functionCall: { name: "computer_click", args: {...} } }
Receive: { type: "transcript", text: "I'll click on the Chrome icon..." }
Receive: { type: "audio", data: "<base64>" }
```

**Gemini 3.0 with Continuous Video Streaming:**

```typescript
// 1. Create a Gemini 3.0 Live session with video streaming enabled
POST /api/live/create
Body: { 
  enableComputerUse: true, 
  enableVideoStreaming: true,
  useGemini3: true,
  desktopSessionId: "..." 
}

// 2. Connect to WebSocket
WS: /api/live/stream/{sessionId}

// 3. Link to desktop session
Send: { type: "linkDesktop", desktopSessionId: "session-123" }

// 4. Stream video frames (continuous at 1 FPS)
Send: { type: "videoFrame", data: "<base64-jpeg>", mimeType: "image/jpeg" }

// 5. Speak or send text
Send: { type: "audio", data: "<base64-pcm>", mimeType: "audio/pcm" }
Send: { type: "text", text: "What do you see on screen?" }

// 6. Receive real-time analysis and function calls
Receive: { type: "functionCall", functionCall: { name: "computer_click", args: {...} } }
Receive: { type: "transcript", text: "I can see a Chrome window with..." }
Receive: { type: "audio", data: "<base64>" }
```

**Key Differences:**
- **Gemini 2.5**: Turn-based screenshots (one per decision)
- **Gemini 3.0**: Continuous video stream (1 FPS JPEG frames) + turn-based screenshots for decisions

---

## Comparison

| Feature | Browser Use | Computer Use (Project Ghost) |
|---------|-------------|------------------------------|
| Scope | Web pages only | Entire desktop |
| Speed | Fast (direct API) | Moderate (vision + execution) |
| Reliability | High (DOM selectors) | High (Gemini 2.5 vision) |
| Setup | None (server-side) | Requires desktop agent |
| Apps Supported | Web apps | Any application |
| Voice Control | Via Live API | Native via Live API |
| Model | Various Gemini models | Gemini 2.5 Computer Use |

---

## Usage Examples (Project Ghost)

### Example 1: Voice-Driven Web Search

```
User: "Search for the latest AI news on Google"

AI Actions:
1. computer_click(x=100, y=50)  // Click address bar
2. computer_type(text="google.com")
3. computer_key(key="Enter")
4. computer_wait(delay=2000)
5. computer_click(x=400, y=300)  // Click search box
6. computer_type(text="latest AI news")
7. computer_key(key="Enter")

Result: Google search results displayed for "latest AI news"
```

### Example 2: Automated Form Filling

```
User: "Fill out this registration form with my info"

AI Actions:
1. computer_click(x=300, y=200)  // First name field
2. computer_type(text="John")
3. computer_key(key="Tab")
4. computer_type(text="Doe")
5. computer_key(key="Tab")
6. computer_type(text="john.doe@example.com")
7. computer_scroll(direction="down", amount=300)
8. computer_click(x=400, y=500)  // Submit button

Result: Form submitted with user information
```

### Example 3: Application Control

```
User: "Open Visual Studio Code and create a new Python file"

AI Actions:
1. computer_key(key="Meta")  // Windows/Command key
2. computer_type(text="visual studio code")
3. computer_key(key="Enter")
4. computer_wait(delay=3000)
5. computer_key(key="Control", modifiers=["Control"])
6. computer_key(key="n")  // Ctrl+N for new file
7. computer_key(key="Control", modifiers=["Control"])
8. computer_key(key="k")  // Ctrl+K
9. computer_key(key="m")  // Select language mode
10. computer_type(text="python")
11. computer_key(key="Enter")

Result: New Python file created in VS Code
```

---

## Safety Features

Project Ghost includes several safety mechanisms:

1. **Confirmation Prompts**: Destructive actions require user confirmation
2. **Action Logging**: All actions are logged for audit trails
3. **Control Modes**: 
   - `user` - Only user can control
   - `ai` - Only AI can control  
   - `shared` - Both can control
4. **Max Steps Limit**: Prevents infinite loops (default: 10 steps)
5. **Keyword Detection**: Flags dangerous keywords (delete, purchase, etc.)

---

## Tool Calls

### Browser Use Tools

```typescript
// Navigate and click
{ tool: "browser_navigate", params: { url: "https://github.com" } }
{ tool: "browser_click", params: { selector: "#sign-in-btn" } }
{ tool: "browser_type", params: { selector: "#username", text: "user@example.com" } }
{ tool: "browser_screenshot" }
```

### Computer Use Tools (Project Ghost)

```typescript
// Official Gemini Computer Use function calls
{ tool: "computer_click", params: { x: 500, y: 300, button: "left" } }
{ tool: "computer_type", params: { text: "Hello world" } }
{ tool: "computer_key", params: { key: "Enter" } }
{ tool: "computer_scroll", params: { direction: "down", amount: 300 } }
{ tool: "computer_move", params: { x: 100, y: 100 } }
{ tool: "computer_screenshot", params: { fullScreen: true } }
{ tool: "computer_wait", params: { delay: 1000 } }
```

---

## Installation

### Browser Use

No installation required - Playwright runs on the server via Browserbase.

### Computer Use (Project Ghost)

See [Installing the Desktop Agent](./install-desktop-agent.md) for setup instructions.

---

## Related Documentation

- [Collaborative Editing](./collaborative-editing.md) - Voice-guided collaboration
- [Installing the Browser Extension](./install-browser-extension.md) - Chrome extension setup
- [Installing the Desktop Agent](./install-desktop-agent.md) - Desktop agent setup
- [Agent Configuration](./agent-configuration.md) - Tool and behavior settings
- [Ragent Index](./INDEX.md) - All agent documentation
