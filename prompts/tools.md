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

### HTTP Client (Direct API Access)

Use these tools for direct HTTP requests to APIs, webhooks, and web services. They provide more control than `web_search` or `browser_scrape`.

| Tool | Parameters | Description |
|------|------------|-------------|
| `http_get` | `url`, `headers?`, `params?`, `timeout?` | GET request to fetch data from any API or endpoint |
| `http_post` | `url`, `headers?`, `body`, `timeout?` | POST request to submit data to APIs or webhooks |
| `http_put` | `url`, `headers?`, `body`, `timeout?` | PUT request to update resources via RESTful APIs |

**When to use HTTP client tools:**
- Need to authenticate with API keys or tokens (via `headers`)
- Must send structured JSON data in request body
- Interacting with RESTful APIs that require POST/PUT operations
- Need to set custom headers (Content-Type, Authorization, Accept, etc.)
- Want raw response data (JSON, text, or binary as base64)

**Parameters:**
- `url` (required): Full URL starting with `http://` or `https://`
- `headers` (optional): Object with header key-value pairs, e.g., `{"Authorization": "Bearer TOKEN", "Content-Type": "application/json"}`
- `params` (optional, GET only): Query parameters as object, automatically appended to URL
- `body` (required for POST/PUT): String or object to send (objects are JSON stringified automatically)
- `timeout` (optional): Request timeout in milliseconds (default: 30000)

**Response includes:**
- `success`: Boolean indicating if request succeeded (HTTP 2xx status)
- `status`: HTTP status code (200, 404, 500, etc.)
- `headers`: Response headers as object
- `data`: Parsed response body (JSON object, text string, or base64 for binary)
- `error`: Error message if request failed

**Examples:**
```json
// GET with authentication
{"type": "http_get", "parameters": {
  "url": "https://api.github.com/user/repos",
  "headers": {"Authorization": "token ghp_xxx"}
}}

// POST JSON data
{"type": "http_post", "parameters": {
  "url": "https://api.example.com/webhook",
  "body": {"event": "deploy", "status": "success"}
}}

// PUT to update resource
{"type": "http_put", "parameters": {
  "url": "https://api.example.com/tasks/123",
  "headers": {"Authorization": "Bearer xxx"},
  "body": {"status": "completed"}
}}
```

**Security features:**
- URL validation (HTTP/HTTPS only)
- Header sanitization (removes control characters)
- Timeout protection (30s default, configurable)
- Response size limit (10MB max)

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

## GitHub

### Repository Operations
| Tool | Parameters | Description |
|------|------------|-------------|
| `github_repos` | `username?` | List repositories |
| `github_contents` | `owner`, `repo`, `path?` | Browse directory contents |
| `github_file_read` | `owner`, `repo`, `path` | Read file contents |
| `github_code_search` | `query`, `owner?`, `repo?` | Search code |
| `github_repo_create` | `name`, `description?`, `isPrivate?`, `autoInit?` | Create new repository |
| `github_repo_fork` | `owner`, `repo`, `organization?`, `name?` | Fork a repository |

### Issue Management
| Tool | Parameters | Description |
|------|------------|-------------|
| `github_issues` | `owner`, `repo`, `state?` | List issues |
| `github_issue_create` | `owner`, `repo`, `title`, `body?`, `labels?`, `assignees?`, `milestone?` | Create issue |
| `github_issue_update` | `owner`, `repo`, `issueNumber`, `title?`, `body?`, `state?`, `labels?`, `assignees?`, `milestone?` | Update issue |
| `github_issue_comment` | `owner`, `repo`, `issueNumber`, `body` | Add comment |
| `github_milestones` | `owner`, `repo`, `state?` | List available milestones |
| `github_labels` | `owner`, `repo` | List available labels |

### Pull Request Operations
| Tool | Parameters | Description |
|------|------------|-------------|
| `github_pulls` | `owner`, `repo`, `state?` | List PRs |
| `github_pr_create` | `owner`, `repo`, `title`, `body?`, `head`, `base` | Create PR |
| `github_pr_merge` | `owner`, `repo`, `pullNumber`, `commitTitle?`, `commitMessage?`, `mergeMethod?` | Merge PR (merge/squash/rebase) |
| `github_pr_review_request` | `owner`, `repo`, `pullNumber`, `reviewers`, `teamReviewers?` | Request reviewers |

### Branch & Commit Operations
| Tool | Parameters | Description |
|------|------------|-------------|
| `github_commits` | `owner`, `repo`, `maxResults?` | List commits |
| `github_branch_list` | `owner`, `repo` | List all branches |
| `github_branch_create` | `owner`, `repo`, `branch`, `sourceBranch?` | Create branch |
| `github_branch_delete` | `owner`, `repo`, `branch` | Delete branch |
| `github_file_create` | `owner`, `repo`, `path`, `content`, `message`, `branch?` | Create/update file |

### Releases & CI/CD
| Tool | Parameters | Description |
|------|------------|-------------|
| `github_release_create` | `owner`, `repo`, `tagName`, `name?`, `body?`, `draft?`, `prerelease?`, `targetCommitish?` | Create release |
| `github_workflows_list` | `owner`, `repo` | List GitHub Actions workflows |
| `github_actions_trigger` | `owner`, `repo`, `workflowId`, `ref`, `inputs?` | Trigger workflow dispatch |

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

| Tool | Parameters |
|------|------------|
| `sms_send` | `to`, `body` |
| `sms_list` | `limit?` |
| `call_make` | `to`, `message?`, `twimlUrl?` |
| `call_list` | `limit?` |

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
