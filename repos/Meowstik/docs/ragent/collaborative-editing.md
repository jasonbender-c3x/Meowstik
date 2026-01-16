# Collaborative Editing

> Real-time AI collaboration with voice, code, and full desktop control

---

## Overview

Collaborative Editing enables **hands-free, continuous interaction** between user and AI. Two distinct modes serve different use cases—from focused code editing to full desktop control.

---

## Two Modes of Operation

### Mode A: Enhanced Turn-Based

**How it works:** User and AI take turns editing the canvas/editor. After each turn, control passes to the other party automatically.

| Phase | What Happens |
|-------|--------------|
| **User's Turn** | User speaks or types. Edits the canvas freely. |
| **Send to LLM** | After user finishes, message sent to LLM. |
| **LLM's Turn** | AI processes, makes edits, sends response. |
| **Mic Re-activates** | After LLM finishes, microphone turns back on. |
| **Silence Detection** | After X seconds of silence, auto-press send. |
| **Loop Continues** | Becomes continuous, hands-free conversation. |

**Key Innovation:** The silence detection creates a **continuous hands-free loop**—no button pressing needed after initial start.

| Component | Description | Status |
|-----------|-------------|--------|
| [Live Voice](/live) | Gemini Live API with WebSocket streaming | ✅ Exists |
| [Monaco Editor](/workspace) | Syntax highlighting, IntelliSense | ✅ Exists |
| [Preview Pane](/workspace) | Live HTML/CSS/JS preview | ✅ Exists |
| Turn-Based Protocol | OT conflict resolution | 🔧 Backend Ready (frontend simulates) |
| Silence Detection | Auto-send after X seconds quiet | ✅ Implemented |
| Auto Mic Toggle | Re-enable mic after LLM turn | ✅ Implemented |
| Silence Duration Slider | Configure 0.5-5s timeout | ✅ Implemented |
| Audio Level Visualizer | Real-time audio waveform | ✅ Implemented |

**Data Flow:**
```
┌─────────────────────────────────────────────────────────┐
│                    CONTINUOUS LOOP                       │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  User Speaks ──► [Silence X sec] ──► Auto-Send          │
│       │                                   │             │
│       ▼                                   ▼             │
│  Edit Canvas                         LLM Processes      │
│       │                                   │             │
│       │                                   ▼             │
│       │                            LLM Edits Canvas     │
│       │                                   │             │
│       │                                   ▼             │
│       │◄──────────── Mic Re-activates ────┘             │
│       │                                                 │
│       └──────────► User Speaks (loop) ──────────────────┘
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Key Files:**
- [`server/websocket-collab.ts`](/docs/02-ui-architecture) — Turn state management
- [`client/src/hooks/use-collaborative-editing.ts`](/docs/02-ui-architecture) — Editor guards
- [`client/src/hooks/use-silence-detection.ts`](/docs/02-ui-architecture) — Silence detection hook
- [`client/src/hooks/use-voice-recording.ts`](/docs/02-ui-architecture) — Voice recording hook
- [`server/services/collab-integration.ts`](/docs/02-ui-architecture) — WebSocket wiring

---

### Mode B: 2-Way Real-Time (Full Desktop)

**How it works:** Real-time verbal discussion while AI sees and controls the entire desktop. Not limited to code editor—works with **anything a computer can do**.

| Capability | Description |
|------------|-------------|
| **Verbal Discussion** | Real-time voice conversation, no waiting |
| **Text Transcripts** | All speech transcribed for reference |
| **Desktop Vision** | AI sees screen at 1 frame per second |
| **Tool Calls** | AI can search, request info, execute actions |
| **Mouse Control** | AI can click, drag, scroll |
| **Keyboard Control** | AI can type, use shortcuts |
| **Any Application** | Photoshop, Excel, browser, terminal, anything |
| **Accessibility** | Fully hands-free for disabled users |

| Component | Description | Status |
|-----------|-------------|--------|
| [Live Voice](/live) | Real-time Gemini Live | ✅ Exists |
| [Browser Page](/browser) | Browserbase + Playwright | ✅ Exists |
| [Collaborate Page](/collaborate) | TeamViewer-style hub | ✅ Implemented |
| Mode Selector UI | Switch between Mode A/B | ✅ Implemented |
| Desktop Vision | 1 FPS screen capture to AI | 🔧 UI Ready |
| Desktop Relay | Cloud relay for frames | 📋 Planned |
| Desktop Agent | Local capture + mouse/keyboard injection | ✅ Package Ready |
| Transcript Panel | Live text of conversation | ✅ Implemented |

**Data Flow:**
```
┌─────────────────────────────────────────────────────────┐
│                   REAL-TIME 2-WAY                        │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  User Speaks ◄─────────────────────► AI Speaks          │
│       │            (simultaneous)          │            │
│       ▼                                    ▼            │
│  Transcript ◄──────────────────────► Transcript         │
│                                                         │
│  Desktop Screen ───[1 FPS]───► Gemini Vision            │
│       ▲                              │                  │
│       │                              ▼                  │
│       │                        AI Decides Action        │
│       │                              │                  │
│       │                              ▼                  │
│  Mouse/Keyboard ◄─── Tool Calls ────┘                   │
│  (any app)                                              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Key Files:**
- [`server/routes/browser.ts`](/docs/02-ui-architecture) — Screenshot + navigation
- [`packages/desktop-agent/`](/docs/SYSTEM_OVERVIEW) — Desktop agent package
- [`packages/extension/`](/docs/SYSTEM_OVERVIEW) — Chrome extension

**Accessibility Focus:** This mode is designed to be **fully hands-free**, enabling users with disabilities to control their computer entirely through voice.

---

## Architecture Layers

### Layer 1: Voice Channel (Shared)

Both modes use [Gemini Live API](/live) for real-time conversation:

```typescript
// WebSocket connection to Gemini
const ws = new WebSocket(GEMINI_LIVE_ENDPOINT);
ws.send(JSON.stringify({ audio: base64AudioChunk }));
ws.onmessage = (e) => playAudioResponse(e.data);
```

See: [Verbosity Slider](./agent-configuration.md#verbosity-slider) for audio output modes.

---

### Layer 2: Editing Protocol (Code Mode)

**Operational Transform (OT)** for conflict resolution:

1. User edit → local apply → send operation to server
2. Server validates against current state
3. Server broadcasts transformed operation to all clients
4. AI receives, applies, responds with own operations

**Turn-Based Control:**

| State | User Can Edit | AI Can Edit |
|-------|---------------|-------------|
| `user_turn` | ✅ Yes | ❌ No |
| `ai_turn` | ❌ No | ✅ Yes |
| `paused` | ❌ No | ❌ No |

Guards in `use-collaborative-editing.ts`:
- `isEditingAllowed(turn, role)` — Check permission
- `getEditorOptions(turn)` — Set readOnly flag
- `updateEditorReadOnly(editor, turn)` — Runtime toggle

---

### Layer 3: Browser Protocol (Browser Mode)

**Playwright Actions via WebSocket:**

```typescript
// AI sends action
{ type: 'click', selector: '#submit-btn' }
{ type: 'type', selector: 'input[name=email]', text: 'user@example.com' }
{ type: 'navigate', url: 'https://example.com' }
{ type: 'screenshot' } // Returns base64 image for AI vision
```

**AI Vision Loop:**
1. Capture screenshot → send to Gemini Vision
2. AI analyzes UI → decides next action
3. Execute Playwright command → capture result
4. Repeat until task complete

---

## Integration Points

### With Job Orchestration

Complex collaborative tasks can spawn [background jobs](./job-orchestration.md):

```typescript
// User: "Refactor this entire file"
// AI creates job DAG:
{
  "tasks": [
    { "id": "analyze", "action": "analyze_code" },
    { "id": "plan", "depends": ["analyze"] },
    { "id": "refactor", "depends": ["plan"] },
    { "id": "test", "depends": ["refactor"] }
  ]
}
```

---

### With RAG Context

Collaborative sessions pull context from [RAG Pipeline](/docs/RAG_PIPELINE):

- Previous conversation chunks (semantic similarity)
- Codebase analysis (function signatures, imports)
- Domain knowledge (ingested documents)

---

## UI Pages

| Page | Route | Purpose |
|------|-------|---------|
| [Live Voice](/live) | `/live` | Voice-only conversation |
| [Workspace](/workspace) | `/workspace` | Monaco + chat + preview |
| [Browser](/browser) | `/browser` | Browserbase automation |
| [Collaborate](/collaborate) | `/collaborate` | Desktop collaboration hub |

---

## Implementation Status

| Feature | Status | Next Steps |
|---------|--------|------------|
| Gemini Live WebSocket | ✅ Complete | — |
| Monaco Editor Integration | ✅ Complete | — |
| Turn-Based Protocol | 🔧 In Progress | Wire to frontend |
| OT Conflict Resolution | 🔧 In Progress | Test edge cases |
| Cursor Sharing UI | 📋 Planned | Add cursor overlay |
| Desktop Agent | 📋 Planned | Build Electron wrapper |
| Chrome Extension | 🔧 Partial | Add collab features |

---

## Related Documentation

- [Agent Configuration](./agent-configuration.md) — Behavior & voice settings
- [Job Orchestration](./job-orchestration.md) — Background task processing
- [System Overview](/docs/SYSTEM_OVERVIEW) — Full architecture
- [UI Architecture](/docs/02-ui-architecture) — Frontend components
- [Ragent Index](./INDEX.md) — All agent documentation

---

## Quick Start

**Code Collaboration:**
1. Go to [/workspace](/workspace)
2. Open a file in Monaco editor
3. Start voice with the microphone button
4. Say "Let's edit this together"

**Browser Collaboration:**
1. Go to [/collaborate](/collaborate)
2. Connect to Browserbase or start Desktop Agent
3. Start voice conversation
4. Say "Navigate to [URL] and click [button]"
