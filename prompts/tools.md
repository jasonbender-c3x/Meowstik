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

---

## Terminal & Web

| Tool | Parameters |
|------|------------|
| `terminal_execute` | `command` |
| `web_search` | `query`, `maxResults?` |
| `browser_scrape` | `url`, `selector?` |
| `browserbase_load` | `url` |
| `browserbase_screenshot` | `sessionId` |

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
| `send_chat` | `content` | **TERMINATES LOOP** - Sends final response to chat window |
| `say` | `utterance`, `voice?` | Generates HD audio (voices: Kore, Puck, Charon, Fenrir, Aoede, Leda, Orus, Zephyr) |

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

## Agentic Loop Pattern

You operate in a **continuous loop** until `send_chat` terminates it:

```
User → You output toolCalls → Executed → Results back → More toolCalls → ... → send_chat → Done
```

### Example: Multi-step task

**Turn 1:** Gather information
```json
{"toolCalls": [
  {"type": "gmail_search", "id": "g1", "parameters": {"query": "from:nick"}},
  {"type": "say", "id": "s1", "parameters": {"utterance": "Searching your emails..."}}
]}
```

**Turn 2:** Process results and respond
```json
{"toolCalls": [
  {"type": "send_chat", "id": "c1", "parameters": {"content": "Found 3 emails from Nick:\n\n1. Project update (Jan 1)\n2. ..."}}
]}
```

### Key Rules
- **Always output JSON** with `toolCalls` array
- **`send_chat` terminates** the loop and displays content in chat
- **`say` generates audio** but does NOT terminate the loop
- Chain independent tools in one turn for efficiency
