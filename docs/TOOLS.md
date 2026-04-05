# Tools Reference

Complete list of every tool Gemini can call in Meowstik. These are defined in `server/gemini-tools.ts` and dispatched by `server/services/tool-dispatcher.ts`.

---

## V2 Core Primitives

The 7 foundational tools that form the base layer.

| Tool | Description | Required params |
|------|-------------|-----------------|
| `terminal` | Execute a non-interactive shell command | `command` |
| `get` | Read file or URL content | `path` |
| `put` | Write content to a file | `path`, `content` |
| `write` | Send markdown to the chat window | `content` |
| `append` | Append content to a named log file | `name`, `content` |
| `say` | Trigger HD voice output (non-blocking) | `utterance` |
| `end_turn` | Terminate the agentic loop turn | *(none)* |

### Notes
- **`end_turn` is mandatory** — the AI must call it to finish its turn in the agentic loop
- **`say` is non-blocking** — speech runs concurrently; you still must call `end_turn`
- **`get`** supports `editor:` and `client:` prefixes for Monaco canvas and remote desktop
- **`put`** supports `editor:` and `client:` prefixes similarly

---

## Voice & Sound

| Tool | Description | Key params |
|------|-------------|------------|
| `say` | Generate voice output | `utterance`, `voice` (optional: Kore/Puck/etc.) |
| `soundboard` | Play a sound effect in the browser | `sound` (e.g., `rimshot`), `volume` (0-1) |

**Soundboard sounds:** `womp_womp`, `rimshot`, `fart`, `fart_long`, `airhorn`, `crickets`, `price_is_wrong`, `laugh_track`, `jingle`, `news_intro`, `alarm_clock`, `gentle_wake`, `pill_reminder`, `urgent_alarm`, `ding`, `success`, `error_buzz`, `level_up`, `incoming`, `traffic_alert`, `weather_beep`

---

## Gmail

| Tool | Description | Required params |
|------|-------------|-----------------|
| `gmail_list` | List recent inbox emails | *(none)* |
| `gmail_read` | Read a specific email | `messageId` |
| `gmail_search` | Search emails (Gmail query syntax) | `query` |
| `gmail_send` | Send an email | `to`, `subject`, `body` |

**Gmail query syntax examples:** `from:nick subject:meeting`, `after:2024/01/01 has:attachment`

---

## Google Drive

| Tool | Description | Required params |
|------|-------------|-----------------|
| `drive_list` | List files | *(none)* |
| `drive_read` | Read file content | `fileId` |
| `drive_search` | Search files | `query` |
| `drive_create` | Create a new file | `name`, `content` |
| `drive_update` | Update file content | `fileId`, `content` |
| `drive_delete` | Delete a file | `fileId` |

---

## Google Calendar

| Tool | Description | Required params |
|------|-------------|-----------------|
| `calendar_list` | List available calendars | *(none)* |
| `calendar_events` | Get events | *(none)* |
| `calendar_create` | Create an event | `summary`, `start`, `end` |
| `calendar_update` | Update an event | `eventId` |
| `calendar_delete` | Delete an event | `eventId` |

---

## Google Docs

| Tool | Description | Required params |
|------|-------------|-----------------|
| `docs_read` | Read a Google Doc | `documentId` |
| `docs_create` | Create a new Doc | `title` |
| `docs_append` | Append content | `documentId`, `content` |
| `docs_replace` | Find and replace text | `documentId`, `find`, `replace` |

---

## Google Sheets

| Tool | Description | Required params |
|------|-------------|-----------------|
| `sheets_read` | Read a range | `spreadsheetId`, `range` |
| `sheets_write` | Write to a range | `spreadsheetId`, `range`, `values` |
| `sheets_append` | Append rows | `spreadsheetId`, `range`, `values` |
| `sheets_create` | Create a new spreadsheet | `title` |
| `sheets_clear` | Clear a range | `spreadsheetId`, `range` |

---

## Google Tasks

| Tool | Description | Required params |
|------|-------------|-----------------|
| `tasks_list` | List tasks | *(none)* |
| `tasks_create` | Create a task | `title` |
| `tasks_update` | Update a task | `taskId` |
| `tasks_complete` | Mark complete | `taskId` |
| `tasks_delete` | Delete a task | `taskId` |

---

## Google Contacts

| Tool | Description | Required params |
|------|-------------|-----------------|
| `contacts_list` | List contacts | *(none)* |
| `contacts_search` | Search contacts | `query` |
| `contacts_create` | Create a contact | `givenName` |
| `contacts_update` | Update a contact | `resourceName` |

---

## Web Search

| Tool | Description | Required params |
|------|-------------|-----------------|
| `web_search` | Google Custom Search | `query` |
| `exa_search` | Exa neural search | `query` |

**Exa options:** `useAutoprompt` (bool), `type` (`neural` | `keyword`), `maxResults`

---

## Browser Automation (Puppeteer)

| Tool | Description | Required params |
|------|-------------|-----------------|
| `puppeteer_navigate` | Navigate to URL | `url` |
| `puppeteer_click` | Click element | `selector` |
| `puppeteer_type` | Type into input | `selector`, `text` |
| `puppeteer_screenshot` | Take screenshot | *(none)* |
| `puppeteer_evaluate` | Run JavaScript | `script` |
| `puppeteer_content` | Get page HTML/text | *(none)* |

---

## HTTP

| Tool | Description | Required params |
|------|-------------|-----------------|
| `http_get` | HTTP GET request | `url` |
| `http_post` | HTTP POST request | `url` |
| `http_put` | HTTP PUT request | `url` |
| `http_patch` | HTTP PATCH request | `url` |
| `http_delete` | HTTP DELETE request | `url` |

All HTTP tools accept optional `headers` object.

---

## Twilio SMS & Voice

| Tool | Description | Required params |
|------|-------------|-----------------|
| `sms_send` | Send an SMS | `to`, `body` |
| `sms_list` | List recent SMS | *(none)* |
| `call_make` | Place an AI-driven phone call | `objective` + (`contact_name` or `to`) |
| `call_list` | List recent calls | *(none)* |

### `call_make` Details

The `call_make` tool places a Twilio call where **Meowstik itself acts as the voice AI** on the call:
- Provide `contact_name` (auto-looks up in Google Contacts) or a direct `to` phone number
- Provide a detailed `objective` describing the full mission
- The AI conducts the entire conversation, completes the mission, and reports back via SMS

---

## Computer Use (Desktop Vision)

| Tool | Description | Required params |
|------|-------------|-----------------|
| `computer_screenshot` | Capture desktop screenshot | *(none)* |
| `computer_click` | Click at coordinates | `x`, `y` |
| `computer_type` | Type text at cursor | `text` |
| `computer_key` | Press a key + optional modifiers | `key` |
| `computer_scroll` | Scroll a direction | `direction` |
| `computer_move` | Move mouse without clicking | `x`, `y` |
| `computer_wait` | Wait N milliseconds | `delay` |

**Typical workflow:** `computer_screenshot` → analyze → `computer_click` at the target element.

---

## Database

| Tool | Description | Required params |
|------|-------------|-----------------|
| `db_tables` | List all tables and columns | *(none)* |
| `db_query` | Run a SELECT query | `query` |
| `db_insert` | Insert a row | `table`, `data` |
| `db_delete` | Delete rows (requires WHERE) | `table`, `where` |

**Safety:** `db_query` only allows SELECT statements. `db_delete` requires a `where` clause.

---

## Todo List

| Tool | Description | Required params |
|------|-------------|-----------------|
| `todo_list` | Get all active todos | *(none)* |
| `todo_add` | Add a new todo | `title` |
| `todo_update` | Update a todo | `id` |
| `todo_complete` | Mark complete | `id` |
| `todo_remove` | Permanently remove | `id` |

---

## Hardware (Experimental / Stubs)

| Tool | Description |
|------|-------------|
| `set_mood_light` | Control HP USB mood lighting (color, status) |

---

## Tool Count Summary

| Category | Count |
|----------|-------|
| Core primitives | 7 |
| Voice & sound | 2 |
| Gmail | 4 |
| Google Drive | 5 |
| Google Calendar | 5 |
| Google Docs | 4 |
| Google Sheets | 5 |
| Google Tasks | 5 |
| Google Contacts | 4 |
| Web search | 2 |
| Browser automation | 6 |
| HTTP | 5 |
| Twilio SMS/Voice | 4 |
| Computer use | 7 |
| Database | 4 |
| Todo list | 5 |
| Hardware | 1 |
| **Total** | **~85** |
