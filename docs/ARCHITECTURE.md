# Architecture

Meowstik uses a hub-and-spoke architecture. The **server** is the single orchestration point — it runs the AI inference pipeline, dispatches tool calls, manages state, and coordinates all connected agents.

---

## System Overview

```mermaid
graph TD
    User[User] <--> Client[Web Client\nReact + Vite]
    Client <-->|"REST + SSE"| Server[Meowstik Server\nExpress + Node.js]

    subgraph "Server Core"
        Server --> Gemini[Google Gemini AI\ngemini-2.0-flash / 2.5-pro]
        Server --> DB[(SQLite Database\nbetter-sqlite3 + Drizzle ORM)]
        Server --> SE[Summarization Engine\ngemini-2.0-flash]
        Server --> EE[Evolution Engine\nFeedback → GitHub PRs]
        Server --> Dispatcher[Tool Dispatcher\nserver/services/tool-dispatcher.ts]
        Server --> JIT[JIT Tool Loader\nserver/services/jit-tool-protocol.ts]
        Server --> Cron[Cron Scheduler\nserver/services/cron-scheduler.ts]
    end

    subgraph "Agents"
        Server <-->|"WebSocket"| Desktop[Desktop Agent\ndesktop-agent/]
        Server <-->|"WebSocket"| Extension[Browser Extension\nbrowser-extension/]
    end

    subgraph "External Integrations"
        Server --> TTS["Google Cloud TTS\nChirp3-HD voices"]
        Server --> GWorkspace["Google Workspace\nGmail · Calendar · Drive · Docs · Sheets"]
        Server --> Twilio["Twilio\nSMS · Voice · Calling AI"]
        Server --> GitHub["GitHub API\nPRs · Issues · Commits"]
        Server --> Exa["Search\nExa + Google Custom Search"]
    end

    Desktop --> LocalOS["Local OS\nScreen · Mouse · Keyboard"]
    Extension --> Browser["User's Browser\nTabs · DOM · Forms"]
```

---

## Request Lifecycle

Every chat message goes through this pipeline:

```mermaid
sequenceDiagram
    participant U as User
    participant C as Client (React)
    participant S as Server
    participant J as JIT Loader
    participant G as Gemini
    participant D as Tool Dispatcher

    U->>C: Send message
    C->>S: POST /api/chats/:id/messages
    S->>S: Load chat history + personality + tools
    S->>J: Predict needed tools (JIT)
    J-->>S: Minimal tool subset
    S->>G: Prompt with history + tools
    G-->>S: Stream: text chunks + tool calls
    S-->>C: SSE: token stream
    loop For each tool call
        S->>D: executeToolCall(toolCall)
        D-->>S: Tool result
        S-->>C: SSE: tool_call_start / tool_call_success
        S->>G: Tool result → continue generation
    end
    S->>S: Save message + tool logs to DB
    S-->>C: SSE: done
```

---

## Directory Structure

```
Meowstik/
├── server/                     # Express backend (port 5000)
│   ├── index.ts                # App entry point
│   ├── routes.ts               # All HTTP routes (~2300 lines)
│   ├── storage.ts              # Database abstraction (Drizzle ORM)
│   ├── db.ts                   # SQLite connection
│   ├── gemini-tools.ts         # Tool declarations for Gemini function calling
│   ├── integrations/           # Third-party service connectors
│   │   ├── expressive-tts.ts   # Google Cloud TTS (Chirp3-HD)
│   │   ├── gemini-live.ts      # Gemini Live streaming API
│   │   ├── gmail.ts            # Gmail API
│   │   ├── google-calendar.ts  # Calendar API
│   │   ├── google-drive.ts     # Drive API
│   │   ├── google-docs.ts      # Docs API
│   │   ├── google-sheets.ts    # Sheets API
│   │   ├── google-contacts.ts  # People API
│   │   ├── github.ts           # GitHub Octokit
│   │   ├── twilio.ts           # Twilio SMS/Voice
│   │   ├── web-search.ts       # Google + Exa search
│   │   └── ...
│   └── services/               # Core business logic
│       ├── tool-dispatcher.ts  # Executes Gemini tool calls
│       ├── evolution-engine.ts # Feedback → patterns → PRs
│       ├── summarization-engine.ts  # Conversation/feedback summarization
│       ├── jit-tool-protocol.ts    # Just-in-time tool selection
│       ├── prompt-composer.ts      # Assembles LLM context
│       ├── cron-scheduler.ts       # Scheduled task runner
│       ├── computer-use.ts         # Vision-based desktop automation
│       ├── ssh-service.ts          # SSH session management
│       └── ...
├── client/                     # React frontend (Vite)
│   ├── src/pages/              # Route pages
│   ├── src/components/         # UI components
│   └── src/hooks/              # React hooks
├── shared/                     # Shared types between server + client
│   └── schema.ts               # Drizzle table definitions + Zod schemas
├── desktop-agent/              # Node.js OS control agent
├── browser-extension/          # Chrome extension
├── prompts/                    # LLM system prompt fragments
│   ├── personality.md          # Character + communication style
│   ├── core-directives.md      # Operational instructions
│   └── tools.md                # Tool usage instructions
└── docs/                       # This documentation
```

---

## Database Schema (Core Tables)

```mermaid
erDiagram
    users ||--o{ chats : owns
    chats ||--o{ messages : contains
    messages ||--o{ attachments : has
    messages ||--o{ feedback : rated_by
    chats ||--o{ conversation_summaries : summarized_in
    messages ||--o{ tool_call_logs : triggers
    messages ||--o{ llm_usage : tracked_by
    users ||--o{ user_branding : customizes

    chats {
        text id PK
        text title
        text userId FK
        timestamp createdAt
        timestamp updatedAt
    }
    messages {
        text id PK
        text chatId FK
        text role "user | assistant | system"
        text content
        timestamp createdAt
    }
    feedback {
        text id PK
        text messageId FK
        text chatId FK
        text rating "positive | negative"
        json categories
        json likedAspects
        json dislikedAspects
        text freeformText
        text promptSnapshot
        text responseSnapshot
        timestamp createdAt
    }
    conversation_summaries {
        text id PK
        text chatId FK
        text summary
        json keyTopics
        text sentiment
        text modelUsed
        timestamp createdAt
    }
    tool_call_logs {
        text id PK
        text chatId FK
        text messageId FK
        text toolType
        text status
        json request
        json response
        integer duration
        timestamp createdAt
    }
```

---

## Prompt Assembly

The system prompt is assembled dynamically per request by `server/services/prompt-composer.ts`:

1. **Core directives** (`prompts/core-directives.md`) — operational rules
2. **Personality** (`prompts/personality.md`) — character, tone, voice style tags
3. **Tool instructions** (`prompts/tools.md`) — how to use tools correctly
4. **User branding** — custom persona name/style if user has configured it
5. **Chat history** — recent messages (windowed)
6. **Attachments** — any files/images in the current message

---

## Real-time Communication

The server uses **Server-Sent Events (SSE)** for streaming:

```
POST /api/chats/:id/messages
  → Response: text/event-stream

Events emitted:
  data: {"type": "token", "content": "..."} 
  data: {"type": "tool_call_start", "toolCallId": "...", "toolType": "..."}
  data: {"type": "tool_call_success", "toolCallId": "...", "duration": 123}
  data: {"type": "tool_call_failure", "toolCallId": "...", "error": "..."}
  data: {"type": "done"}
```

Desktop Agent and Browser Extension use **WebSockets** for bidirectional communication.
