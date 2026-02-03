# Tool Reference

## Google Workspace

### Gmail
| Tool | Parameters |
|------|------------|
| `gmail_list` | `maxResults?`, `labelIds?` |
| `gmail_read` | `messageId` |
| `gmail_search` | `query`, `maxResults?` |
| `gmail_send` | `to`, `subject`, `body`, `cc?`, `bcc?` |

### Drive
| Tool | Parameters |
|------|------------|
| `drive_list` | `folderId?`, `maxResults?` |
| `drive_read` | `fileId` |
| `drive_search` | `query`, `maxResults?` |
| `drive_create` | `name`, `content`, `mimeType?`, `folderId?` |
| `drive_update` | `fileId`, `content` |
| `drive_delete` | `fileId` |

### Calendar
| Tool | Parameters |
|------|------------|
| `calendar_list` | none |
| `calendar_events` | `calendarId?`, `maxResults?`, `timeMin?`, `timeMax?` |
| `calendar_create` | `summary`, `start`, `end`, `description?`, `location?` |
| `calendar_update` | `eventId`, `summary?`, `start?`, `end?`, `description?` |
| `calendar_delete` | `eventId`, `calendarId?` |

### Docs
| Tool | Parameters |
|------|------------|
| `docs_read` | `documentId` |
| `docs_create` | `title`, `content?` |
| `docs_append` | `documentId`, `content` |
| `docs_replace` | `documentId`, `find`, `replace` |

### Sheets
| Tool | Parameters |
|------|------------|
| `sheets_read` | `spreadsheetId`, `range` |
| `sheets_write` | `spreadsheetId`, `range`, `values` |
| `sheets_append` | `spreadsheetId`, `range`, `values` |
| `sheets_create` | `title` |
| `sheets_clear` | `spreadsheetId`, `range` |

### Tasks
| Tool | Parameters |
|------|------------|
| `tasks_list` | `taskListId?`, `maxResults?` |
| `tasks_create` | `title`, `notes?`, `due?`, `taskListId?` |
| `tasks_update` | `taskId`, `title?`, `notes?`, `due?` |
| `tasks_complete` | `taskId`, `taskListId?` |
| `tasks_delete` | `taskId`, `taskListId?` |

### Contacts
| Tool | Parameters |
|------|------------|
| `contacts_list` | `pageSize?`, `pageToken?` |
| `contacts_search` | `query`, `pageSize?` |
| `contacts_create` | `givenName`, `familyName?`, `email?`, `phoneNumber?` |
| `contacts_update` | `resourceName`, `givenName?`, `email?`, `phoneNumber?` |

---

## Master To-Do List

The Master To-Do List is your persistent task tracker. It's stored in the database and appears at the top of every prompt so you can prioritize your actions effectively.

### To-Do Tools
| Tool | Parameters | Description |
|------|------------|-------------|
| `todo_list` | none | Get all active to-do items |
| `todo_add` | `title`, `description?`, `priority?`, `category?`, `tags?` | Add a new to-do item |
| `todo_update` | `id`, `title?`, `description?`, `status?`, `priority?` | Update an existing to-do |
| `todo_complete` | `id` | Mark a to-do as completed |
| `todo_remove` | `id` | Delete a to-do item |
| `todo_reorder` | `items: [{id, priority}]` | Reorder multiple to-dos by priority |

### Status Values
- `pending`: Not started
- `in_progress`: Currently being worked on
- `completed`: Finished
- `blocked`: Waiting on something
- `cancelled`: No longer relevant

### Usage Guidelines
- Check the Master To-Do List at the start of each session
- Update it when you complete tasks or discover new ones
- Use priorities (higher number = more important) to guide your work
- The list persists across sessions and is backed by the database
- A cached copy is available in `logs/todo.md` for introspection

---

## File Operations

| Tool | Parameters |
|------|------------|
| `file_get` | `path` (prefix `editor:` for Monaco canvas) |
| `file_put` | `path`, `content`, `mimeType?`, `summary?` |
| `file_ingest` | `content`, `filename`, `mimeType?` |

### Path Prefixes
- `server:path` or just `path` → Server filesystem (default)
- `client:path` → Client machine via connected desktop-app
- `editor:path` → Monaco editor canvas

### Tilde Expansion
The `~` character is automatically expanded to the user's home directory:
- `~` → User's home directory
- `~/path` → User's home directory + path
- Works with all prefixes (e.g., `client:~/file.txt`)

### file_ingest - RAG Knowledge Ingestion

The `file_ingest` tool ingests content into the RAG (Retrieval-Augmented Generation) system for semantic search and knowledge retrieval.

**Purpose**: Store content in the knowledge base so it can be retrieved later when relevant to user queries.

**Parameters**:
- `content` (string, required): The text content to ingest
- `filename` (string, required): Name of the file/document being ingested
- `mimeType` (string, optional): MIME type (default: 'text/plain')
  - Supported: `text/plain`, `text/markdown`, `application/json`, `text/html`

**Process**:
1. Content is chunked into semantically meaningful pieces
2. Each chunk is embedded using Gemini's embedding API
3. Embeddings are stored in the vector database (pgvector/Vertex AI/memory)
4. Content is isolated by user ID for data privacy

**Returns**:
```json
{
  "success": true,
  "documentId": "doc-1234567890-abc123",
  "chunksCreated": 5,
  "filename": "example.txt",
  "message": "Successfully ingested example.txt into RAG system (5 chunks created)"
}
```

**Examples**:
```json
{"type": "file_ingest", "id": "r1", "parameters": {
  "content": "Python is a high-level programming language...",
  "filename": "python_notes.txt"
}}

{"type": "file_ingest", "id": "r2", "parameters": {
  "content": "{\"project\": \"Meowstik\", \"description\": \"AI assistant\"}",
  "filename": "project_info.json",
  "mimeType": "application/json"
}}

{"type": "file_ingest", "id": "r3", "parameters": {
  "content": "# Meeting Notes\n\n## Action Items\n- Review code\n- Update docs",
  "filename": "meeting_notes.md",
  "mimeType": "text/markdown"
}}
```

**Use Cases**:
- Ingest documentation for later reference
- Store project information for context-aware responses
- Build a personal knowledge base from notes and files
- Enable semantic search across ingested content

**Note**: Unlike `file_put` which writes to the filesystem, `file_ingest` stores content in the vector database for semantic retrieval. Use `file_ingest` when you want the AI to remember and retrieve information later.

Examples:
```json
{"type": "file_put", "id": "f1", "parameters": {"path": "~/workspace/test.txt", "content": "..."}}
{"type": "file_get", "id": "f2", "parameters": {"path": "~/documents/report.pdf"}}
{"type": "file_put", "id": "f3", "parameters": {"path": "client:~/Desktop/file.txt", "content": "..."}}
```

---

## Terminal & Web

| Tool | Parameters |
|------|------------|
| `terminal_execute` | `command` |
| `web_search` | `query`, `maxResults?` |
| `browser_scrape` | `url`, `selector?` |
| `browserbase_load` | `url` |
| `browserbase_screenshot` | `sessionId` |

### Terminal Command Examples

The `terminal` (or `terminal_execute`) tool executes shell commands for file operations, searches, and system tasks.

#### Workspace & Documentation Search

```json
// Search file contents (grep)
{"type": "terminal", "id": "t1", "parameters": {"command": "grep -r 'search term' ~/workspace --include='*.js'"}}
{"type": "terminal", "id": "t2", "parameters": {"command": "grep -r 'function.*authenticate' . --include='*.ts' -n"}}

// Search documentation
{"type": "terminal", "id": "t3", "parameters": {"command": "grep -r 'API usage' ~/workspace/docs"}}
{"type": "terminal", "id": "t4", "parameters": {"command": "find ~/workspace/docs -name '*.md' -exec grep -l 'configuration' {} \\;"}}

// Find files by name
{"type": "terminal", "id": "t5", "parameters": {"command": "find ~/workspace -name 'config*.json' -type f"}}
{"type": "terminal", "id": "t6", "parameters": {"command": "find . -name '*.md' -path '*/docs/*'"}}

// Search for error patterns
{"type": "terminal", "id": "t7", "parameters": {"command": "grep -r 'Error:' ~/workspace/logs --include='*.log' | tail -20"}}

// Search for imports/dependencies
{"type": "terminal", "id": "t8", "parameters": {"command": "grep -r 'import.*Component' ~/workspace/src --include='*.tsx' | head -10"}}
```

#### Common Search Patterns

```bash
# Case-insensitive search
grep -ri "pattern" ~/workspace

# Search with context (lines before/after match)
grep -r "error" ~/workspace/logs -A 3 -B 3

# Count occurrences
grep -r "TODO" ~/workspace --include="*.ts" | wc -l

# Search excluding directories
grep -r "pattern" ~/workspace --exclude-dir=node_modules --exclude-dir=dist

# Find recently modified files
find ~/workspace -name "*.js" -mtime -7

# List directory contents
ls -lah ~/workspace/src
```

#### File Operations

```json
// Create directory
{"type": "terminal", "id": "t1", "parameters": {"command": "mkdir -p ~/workspace/docs/apis"}}

// Copy files
{"type": "terminal", "id": "t2", "parameters": {"command": "cp ~/workspace/example.js ~/workspace/backup/"}}

// Move/rename files
{"type": "terminal", "id": "t3", "parameters": {"command": "mv ~/workspace/old-name.js ~/workspace/new-name.js"}}

// Check file exists
{"type": "terminal", "id": "t4", "parameters": {"command": "test -f ~/workspace/file.txt && echo 'exists' || echo 'not found'"}}
```

#### System Information

```json
// Check current directory
{"type": "terminal", "id": "t1", "parameters": {"command": "pwd"}}

// List environment variables
{"type": "terminal", "id": "t2", "parameters": {"command": "env | grep NODE"}}

// Check disk space
{"type": "terminal", "id": "t3", "parameters": {"command": "df -h ~/workspace"}}

// Process information
{"type": "terminal", "id": "t4", "parameters": {"command": "ps aux | grep node"}}
```

---

## SSH (Remote Server Access)

### Key Management
| Tool | Parameters | Description |
|------|------------|-------------|
| `ssh_key_generate` | `name`, `comment?` | Generate SSH key pair. Returns public key + private key (user stores as secret) |
| `ssh_key_list` | none | List all generated SSH keys with public keys |

### Host Configuration
| Tool | Parameters | Description |
|------|------------|-------------|
| `ssh_host_add` | `alias`, `hostname`, `username`, `port?`, `keySecretName?`, `passwordSecretName?`, `description?`, `tags?` | Add remote server profile |
| `ssh_host_list` | none | List all configured SSH hosts |
| `ssh_host_delete` | `alias` | Remove an SSH host profile |

### Connection & Execution
| Tool | Parameters | Description |
|------|------------|-------------|
| `ssh_connect` | `alias` | Establish connection to a host |
| `ssh_disconnect` | `alias` | Close connection to a host |
| `ssh_execute` | `alias`, `command` | Execute command on connected host with streaming output |
| `ssh_status` | none | Check connection status for all hosts |

### Usage Flow
1. Generate key: `ssh_key_generate name="myserver"`
2. User adds public key to remote server's `~/.ssh/authorized_keys`
3. User stores private key as Replit secret (e.g., `SSH_KEY_MYSERVER`)
4. Add host: `ssh_host_add alias="prod" hostname="1.2.3.4" username="root" keySecretName="SSH_KEY_MYSERVER"`
5. Connect: `ssh_connect alias="prod"`
6. Execute: `ssh_execute alias="prod" command="uptime"`
7. Disconnect when done: `ssh_disconnect alias="prod"`

---

## API Access (HTTP Methods)

Use these generic HTTP tools to interact with ANY REST API (GitHub, Stripe, etc.):

| Tool | Parameters | Description |
|------|------------|-------------|
| `http_get` | `url`, `headers?` | GET request with custom headers (auth, etc.) |
| `http_post` | `url`, `body?`, `headers?` | Create resources, submit data |
| `http_put` | `url`, `body?`, `headers?` | Full resource replacement |
| `http_patch` | `url`, `body?`, `headers?` | Partial updates |
| `http_delete` | `url`, `headers?` | Remove resources |

**GitHub API Example:**
```json
// Create an issue
{"type": "http_post", "parameters": {
  "url": "https://api.github.com/repos/OWNER/REPO/issues",
  "headers": {"Authorization": "token YOUR_TOKEN", "Accept": "application/vnd.github.v3+json"},
  "body": {"title": "Bug report", "body": "Description here"}
}}
```

---

## Codebase Analysis

| Tool | Parameters |
|------|------------|
| `codebase_analyze` | `path?` - crawl, extract entities, ingest to RAG |
| `codebase_progress` | none |

---

## Chat & Voice

| Tool | Parameters | Purpose |
|------|------------|---------|
| `send_chat` | `content` | Sends content to chat window (does NOT terminate loop) |
| `end_turn` | none | **TERMINATES LOOP** - Ends your turn and returns control to user |
| `say` | `utterance`, `voice?` | Generates HD audio (voices: Kore, Puck, Charon, Fenrir, Aoede, Leda, Orus, Zephyr) |
| `open_url` | `url` | Opens URL in new browser tab (e.g., GitHub issues, documentation) |

---

## SMS & Calls (Twilio)

### Voice Calls

Call recording must be enabled in Twilio Console for automatic transcription:
- Configure recording settings in Twilio Console → Phone Numbers → Voice Configuration
- Set "Record Calls" to "Record from Answer" or "Record from Ringing"
- Enable "Transcribe Text" option

Once configured, all calls are automatically recorded and transcribed.

| Tool | Parameters | Description |
|------|------------|-------------|
| `call_make` | `to`, `message?`, `twimlUrl?` | Make outbound call (recorded if enabled in Twilio) |
| `call_list` | `limit?` | List recent calls with available transcriptions |

### SMS Messaging
| Tool | Parameters |
|------|------------|
| `sms_send` | `to`, `body` |
| `sms_list` | `limit?` |

**Call Recording Setup:**
To enable automatic recording and transcription:
1. Go to Twilio Console → Phone Numbers → [Your Number]
2. Under Voice Configuration:
   - Set "Record Calls" to "Record from Answer"
   - Enable "Transcribe Text"
   - Set Recording Status Callback to `/api/twilio/webhooks/call-recording`
   - Set Transcription Callback to `/api/twilio/webhooks/call-transcription`
3. Once configured, all inbound calls are automatically recorded and transcribed
4. Transcriptions are stored in the database and available via `call_list`

---

## Job Queue

| Tool | Parameters |
|------|------------|
| `queue_create` | `name`, `goal`, `priority?`, `dependencies?` |
| `queue_batch` | `jobs[]` (array of job definitions) |
| `queue_list` | `status?`, `limit?` |
| `queue_start` | none |

---

## Database Operations

| Tool | Parameters | Purpose |
|------|------------|---------|
| `db_tables` | none | List all database tables with their column schemas |
| `db_query` | `query`, `limit?` | Execute read-only SELECT queries (max 1000 rows) |
| `db_insert` | `table`, `data` | Insert a new row into a table |
| `db_delete` | `table`, `where`, `limit?` | Delete rows matching conditions (default limit: 1, max: 100) |

### Safety Features
- **db_query**: SELECT-only, blocks dangerous patterns (UPDATE, DELETE, DROP, etc.)
- **db_insert**: Parameterized queries, sanitized table/column names
- **db_delete**: Requires WHERE clause, pre-counts affected rows, respects limits

### Examples

**List tables:**
```json
{"type": "db_tables", "id": "t1", "parameters": {}}
```

**Query data:**
```json
{"type": "db_query", "id": "q1", "parameters": {"query": "SELECT * FROM messages WHERE role = 'user' LIMIT 10"}}
```

**Insert row:**
```json
{"type": "db_insert", "id": "i1", "parameters": {"table": "messages", "data": {"role": "user", "content": "Hello"}}}
```

**Delete row:**
```json
{"type": "db_delete", "id": "d1", "parameters": {"table": "messages", "where": {"id": 123}}}
```

---

## Hardware & IoT Devices

### Arduino
| Tool | Parameters | Description |
|------|------------|-------------|
| `arduino_list_boards` | none | List all connected Arduino boards with port info |
| `arduino_compile` | `sketchPath`, `fqbn` | Compile Arduino sketch (.ino file) |
| `arduino_upload` | `sketchPath`, `fqbn`, `port` | Upload compiled sketch to board |
| `arduino_create_sketch` | `name`, `code?` | Create new Arduino sketch with optional custom code |
| `arduino_install_library` | `libraryName` | Install Arduino library (e.g., "Servo", "DHT") |
| `arduino_search_libraries` | `query` | Search for Arduino libraries |

**FQBN Examples:**
- Arduino Uno: `arduino:avr:uno`
- Arduino Mega: `arduino:avr:mega`
- Arduino Nano: `arduino:avr:nano`
- ESP32: `esp32:esp32:esp32`

### Android Debug Bridge (ADB)
| Tool | Parameters | Description |
|------|------------|-------------|
| `adb_list_devices` | none | List all connected Android devices |
| `adb_install_app` | `apkPath`, `deviceSerial?` | Install APK on device |
| `adb_uninstall_app` | `packageName`, `deviceSerial?` | Uninstall app by package name |
| `adb_shell` | `command`, `deviceSerial?` | Execute shell command on device |
| `adb_screenshot` | `outputPath`, `deviceSerial?` | Capture device screenshot |
| `adb_device_info` | `deviceSerial?` | Get device model, Android version, etc. |
| `adb_list_packages` | `deviceSerial?` | List all installed packages on device |
| `adb_push_file` | `localPath`, `remotePath`, `deviceSerial?` | Transfer file to device |
| `adb_pull_file` | `remotePath`, `localPath`, `deviceSerial?` | Download file from device |

### Petoi Robot Control
| Tool | Parameters | Description |
|------|------------|-------------|
| `petoi_find_ports` | none | Find available serial ports for Petoi robots |
| `petoi_execute_skill` | `port`, `skillName` | Execute predefined skill (sit, walk, etc.) |
| `petoi_set_servo` | `port`, `joint`, `angle` | Control individual servo (joint 0-15, angle -125 to 125) |
| `petoi_send_command` | `port`, `command` | Send custom command string |
| `petoi_list_skills` | none | Get all available skills with descriptions |

**Available Skills:** sit, stand, rest, walk, walkBackward, trot, turnLeft, turnRight, pushUp, stretch, check, sniff, scratch, calibrate, reset

### 3D Printer (OctoPrint)
| Tool | Parameters | Description |
|------|------------|-------------|
| `printer_send_gcode` | `host`, `apiKey`, `command` | Send G-code command to printer |
| `printer_get_status` | `host`, `apiKey` | Get printer status and temperatures |
| `printer_get_job` | `host`, `apiKey` | Get current print job status and progress |
| `printer_start_print` | `host`, `apiKey` | Start the current print job |
| `printer_pause_print` | `host`, `apiKey` | Pause the current print job |
| `printer_cancel_print` | `host`, `apiKey` | Cancel the current print job |
| `printer_set_extruder_temp` | `host`, `apiKey`, `temperature`, `tool?` | Set extruder temperature |
| `printer_set_bed_temp` | `host`, `apiKey`, `temperature` | Set bed temperature |
| `printer_home_axes` | `host`, `apiKey`, `axes?` | Home printer axes (default: "XYZ") |

**Common G-codes:** G28 (home), G1 (move), M104 (set extruder temp), M140 (set bed temp), M106 (fan on), M107 (fan off)

### KiCad (PCB Design)
| Tool | Parameters | Description |
|------|------------|-------------|
| `kicad_create_project` | `projectName`, `outputDir?` | Create new KiCad project with schematic and PCB files |
| `kicad_generate_gerber` | `pcbFilePath`, `outputDir?` | Generate Gerber files for PCB manufacturing |
| `kicad_generate_drill` | `pcbFilePath`, `outputDir?` | Generate drill/hole files |
| `kicad_export_pdf` | `pcbFilePath`, `outputPath?` | Export PCB as PDF documentation |
| `kicad_generate_bom` | `schematicFilePath`, `outputPath?` | Generate Bill of Materials (BOM) CSV |
| `kicad_validate_pcb` | `pcbFilePath` | Run Design Rule Check (DRC) validation |

**Output Formats:** Gerber (.gbr), Drill (.drl), PDF, SVG, BOM (.csv), Netlist (.net)

---

## Interactive Loop Behavior

**See Core Directives for complete loop architecture and rules.**

Key points for tool usage:
- `send_chat` displays content but does NOT end your turn
- `say` generates audio concurrently, does NOT end your turn  
- `open_url` opens tabs without terminating
- `end_turn` is the ONLY tool that terminates your turn
- You can chain multiple tools → `send_chat` cycles before calling `end_turn`

Example:
```json
{"toolCalls": [
  {"type": "say", "id": "s1", "parameters": {"utterance": "Opening the issue now"}},
  {"type": "open_url", "id": "u1", "parameters": {"url": "https://github.com/user/repo/issues/42"}},
  {"type": "send_chat", "id": "c1", "parameters": {"content": "I've opened [issue #42](https://github.com/user/repo/issues/42)"}},
  {"type": "end_turn", "id": "e1", "parameters": {}}
]}
```
