# Features

Current feature set of Meowstik as it exists today.

---

## ✅ Chat & Agentic Loop

**Status: Active**

The core loop: user sends a message → Gemini generates a response with optional tool calls → tools execute in parallel → results fed back → Gemini continues. This loop runs until `end_turn` is called.

- Streaming responses via SSE
- Multi-turn conversation history
- Message attachments (images, files)
- Tool call visibility (UI shows each tool executing with timing)
- Structured response parsing

---

## ✅ Voice Synthesis — Google Cloud TTS (Chirp3-HD)

**Status: Active**

High-quality voice output using Google's 2025 Chirp3-HD neural voices. See [TTS.md](./TTS.md) for full documentation.

- 10 HD voices: Kore (default), Puck, Charon, Fenrir, Aoede, Leda, Orus, Zephyr, Schedar, Sulafat
- Expressive style tags: `[style: cheerful]`, `[style: sad]`, `[style: tense]`, etc.
- Plain text input — no SSML required
- `say` tool: AI can trigger voice output mid-conversation

---

## ✅ Voice Lab

**Status: Active**

UI at `/voice-lab` for previewing all available voices in real time. Users can:
- Listen to each voice with a test phrase
- Set their preferred default voice
- Preferences persisted per-user in `user_branding` table

---

## ✅ Expressive Voice Styles

**Status: Active**

The AI uses style tags embedded in text to control TTS tone. See [TTS.md](./TTS.md#expressive-styles).

```
[style: cheerful] I found the answer!
[style: sad] Unfortunately, the file was deleted.
[style: surprised] That's not something I expected to find.
```

---

## ✅ File-Based Short-Term Memory

**Status: Active**

Persistent memory stored in `logs/Short_Term_Memory.md` and managed by `server/services/prompt-composer.ts`. Injected into the system prompt on every turn so the AI always has session context.

- AI appends to `logs/STM_APPEND.md`; `prompt-composer.ts` auto-merges it into the main memory file
- `logs/cache.md` holds "thoughts forward" from the previous turn
- Named log files via `append` tool (e.g., `logs/execution.md`, `logs/thoughts.md`)
- Append/log tool calls now close out their `tool_call_logs` rows correctly, so append activity no longer gets stuck as permanently pending in the chat UI
- Human-readable — memory can be directly edited by the user

---

## ✅ Summarization Engine

**Status: Active** — See [SUMMARIZATION_ENGINE.md](./SUMMARIZATION_ENGINE.md)

Compresses conversations and feedback batches into structured summaries using Gemini 2.0 Flash. These summaries feed the Evolution Engine's pattern analysis.

- `summarizeConversation(chatId)` — 2-3 sentence summary + key topics + sentiment
- `summarizeFeedbackBatch(items)` — patterns, common issues, improvement areas
- `getOrCreateSummary(chatId)` — cached, checks DB before generating
- Results stored in `conversation_summaries` table

---

## ✅ Evolution Engine

**Status: Active** — See [EVOLUTION_ENGINE.md](./EVOLUTION_ENGINE.md)

Closes the feedback loop:
1. Collects user feedback from database
2. Runs `summarizeFeedbackBatch` for AI-extracted patterns
3. Combines with structural analysis (low-rated categories, disliked aspects)
4. Sends patterns to Gemini for improvement suggestions
5. Creates a GitHub PR with analysis report and suggestions
6. Tags `@copilot` to trigger automated implementation review

---

## ✅ Local Computer Use Runtime

**Status: Active** — See [DESKTOP_APP.md](./DESKTOP_APP.md)

Primary computer-use now runs **on the same machine as Meowstik** through `server/services/desktop-service.ts` and `server/services/computer-use.ts`:
- Screen capture via `screenshot-desktop`
- Mouse and keyboard control via `@nut-tree-fork/nut-js`
- Gemini Computer Use toolset: `computer_click`, `computer_type`, `computer_key`, `computer_scroll`, `computer_move`, `computer_screenshot`, `computer_wait`
- Optional WebSocket relay modes still exist for advanced/legacy setups, but they are not the main local-install path

---

## ✅ Browser Extension

**Status: Active** — See [AGENTS.md](./AGENTS.md)

Chrome extension with a side-panel chat interface:
- Reads active tab URL and page content
- DOM manipulation
- Form filling
- Tab management
- Connects to server via WebSocket

---

## ✅ MCP Servers

**Status: Active**

Meowstik now supports configurable MCP servers through a built-in catalog plus user-managed entries:
- Persistent MCP server configuration stored in the app database
- Supported transports: `stdio`, streamable HTTP, and legacy SSE
- Agent tools: `mcp_list_servers`, `mcp_list_tools`, `mcp_call`
- Settings UI for browsing the MCP library, enabling servers, testing connections, and inspecting exposed tools
- Built-in library entries for the official/reference servers: `filesystem`, `fetch`, `git`, `memory`, `time`, `sequentialthinking`, and `everything`
- Built-in Nelson MCP entry for LibreOffice-compatible workflows

---

## ✅ External Skills Discovery

**Status: Active**

Meowstik now discovers local assistant instruction/skill markdown files and summarizes them into the system prompt:
- Scans common roots such as the current repo, `~/.claude`, `~/.gemini`, `~/.copilot`, and the local Claude code mirror
- Exposes discovered entries in the Settings UI
- Injects a prompt-safe summary through `server/services/prompt-composer.ts`
- Current support is discovery + prompt inclusion, not execution of third-party skill DSLs

---

## ✅ Twilio SMS & Voice

**Status: Active** — See [INTEGRATIONS.md](./INTEGRATIONS.md)

- Receive and reply to inbound SMS
- Send outbound SMS via `sms_send` tool
- Inbound call handling with AI receptionist (TwiML)
- Outbound AI calling via `call_make` tool — AI handles the full conversation
- Voicemail transcription and storage
- All messages stored in `sms_messages` + `call_conversations` tables

---

## ✅ Google Workspace Integration

**Status: Active**

Full read/write access to Google services via OAuth:

| Service | Tools |
|---------|-------|
| Gmail | `gmail_list`, `gmail_read`, `gmail_search`, `gmail_send` |
| Calendar | `calendar_list`, `calendar_events`, `calendar_create`, `calendar_update`, `calendar_delete` |
| Drive | `drive_list`, `drive_read`, `drive_search`, `drive_create`, `drive_update`, `drive_delete` |
| Docs | `docs_read`, `docs_create`, `docs_append`, `docs_replace` |
| Sheets | `sheets_read`, `sheets_write`, `sheets_append`, `sheets_create`, `sheets_clear` |
| Tasks | `tasks_list`, `tasks_create`, `tasks_update`, `tasks_complete`, `tasks_delete` |
| Contacts | `contacts_list`, `contacts_search`, `contacts_create`, `contacts_update` |

---

## ✅ GitHub Integration

**Status: Active**

Full GitHub API access for the Evolution Engine and for user-initiated operations:
- Create/update files, branches, commits
- Create pull requests with agent attribution
- Add PR comments, tag `@copilot`
- List repos, issues, PRs
- Used by the Evolution Engine to propose improvements

---

## ✅ SSH Gateway

**Status: Active**

Persistent SSH sessions to remote servers:
- Connect to any SSH server with credentials
- Execute commands and stream output
- Manage multiple concurrent sessions
- `ssh` tool provides a 2-way terminal-like interface

---

## ✅ Web Search

**Status: Active**

Dual search backends:
- **Exa** (`exa_search`) — neural search engine, best for semantic queries
- **Google Custom Search** (`web_search`) — traditional keyword search

---

## ✅ Browser Automation (Puppeteer)

**Status: Active**

Headless browser via Puppeteer for web scraping and automation:
- `puppeteer_navigate` — load any URL
- `puppeteer_click` — click elements by CSS selector
- `puppeteer_type` — fill input fields
- `puppeteer_screenshot` — capture page visuals
- `puppeteer_evaluate` — run JavaScript in page context
- `puppeteer_content` — extract page HTML/text

---

## ✅ Cron Scheduler

**Status: Active**

Schedule recurring tasks using cron expressions:
- Parse and evaluate standard cron syntax
- Calculate next run times
- Trigger workflows on schedule
- Track consecutive failures
- Timezone support

---

## ✅ Computer Use (Vision-Based Desktop Automation)

**Status: Active**

Gemini-powered vision automation that analyzes screenshots to control the desktop:
- Takes a screenshot, analyzes it, determines where to click
- Works directly against the local runtime's desktop service on the same machine
- Tools: `computer_screenshot` → `computer_click` / `computer_type` / `computer_key` / `computer_scroll`

---

## ✅ Live Mode (Gemini Live API)

**Status: Active**

Real-time voice conversation using Gemini's Live API:
- Microphone input with silence detection
- Streaming bidirectional audio
- Low-latency responses
- Available at `/live` route
- Unmount-only disconnect cleanup so clicking **Connect** no longer immediately tears the session down on ordinary re-renders

---

## ✅ Main Chat + Workbench UX

**Status: Active**

The right-side workbench is now a lighter secondary surface instead of a second prompt entry point:
- Workbench starts closed by default
- Main chat input is the primary place to talk to Meowstik
- Workbench-local prompt/send row was removed
- Workbench screen-record button was removed from the header
- Voice input failures in the main chat are shown inline instead of as destructive toast popups

---

## ✅ Todo System

**Status: Active**

Persistent task list with the `todo_*` tools:
- `todo_list`, `todo_add`, `todo_update`, `todo_complete`, `todo_remove`
- Stored in `todo_items` table per user
- Priority, category, tags, status tracking

---

## ✅ Database Tool Access

**Status: Active**

The AI can inspect and query its own database:
- `db_tables` — list all tables and columns
- `db_query` — run SELECT queries
- `db_insert` — insert rows
- `db_delete` — delete rows with WHERE

---

## ✅ Google OAuth + Persona Customization

**Status: Active**

- Google OAuth 2.0 login
- Per-user branding: custom display name, avatar, GitHub signature
- Stored in `user_branding` table
- Evolution Engine uses the user's GitHub signature for attributed PRs

---

## ✅ HTTP Tools

**Status: Active**

Make arbitrary HTTP requests from within a conversation:
- `http_get`, `http_post`, `http_put`, `http_patch`, `http_delete`
- Custom headers support (for API keys, Authorization, etc.)
- Useful for calling any third-party API

---

## ✅ JIT Tool Loading

**Status: Active**

Just-in-time tool selection (`server/services/jit-tool-protocol.ts`):
- Predicts which tools are likely needed for each message
- Loads only that subset into the Gemini context window
- Keeps prompts lean and fast, especially for non-tool conversations

---

## ✅ LLM Usage Tracking

**Status: Active**

Every LLM call is logged with:
- Input/output token counts
- Model used
- Duration
- Cost estimation
- Available via `/api/llm/usage`

---

## 🔧 Hardware Control (Stubs)

**Status: Stub / Experimental**

- `set_mood_light` — HP USB mood lighting device
- Arduino integration (`server/integrations/arduino.ts`)
- ADB Android device control (`server/integrations/adb.ts`)
- 3D printer (`server/integrations/printer3d.ts`)
- KiCad EDA (`server/integrations/kicad.ts`)
