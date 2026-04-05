# 04 - Tool Taxonomy

## All 102 Tools: Analysis and Consolidation Plan

---

## Current State

The system has **102 native tool definitions**. Many are redundant, unused, or reducible to primitives.

---

## Usage Statistics (From Execution Logs)

### Top 25 Most Used

| Rank | Tool | Count | Category |
|------|------|-------|----------|
| 1 | `say` | 188 | voice |
| 2 | `terminal_execute` | 74 | system |
| 3 | `send_chat` | 56 | output |
| 4 | `file_get` | 56 | file |
| 5 | `file_put` | 49 | file |
| 6 | `github_issue_create` | 38 | github |
| 7 | `github_code_search` | 15 | github |
| 8 | `github_issue_update` | 14 | github |
| 9 | `web_search` | 13 | search |
| 10 | `github_issues` | 13 | github |
| 11 | `browser_scrape` | 10 | browser |
| 12 | `drive_create` | 7 | drive |
| 13 | `sms_send` | 5 | communication |
| 14 | `github_issue_comment` | 5 | github |
| 15 | `log_append` | 4 | logging |
| 16 | `github_file_read` | 3 | github |
| 17 | `github_file_create` | 3 | github |
| 18 | `github_contents` | 3 | github |
| 19 | `call_make` | 3 | communication |
| 20 | `sms_list` | 2 | communication |
| 21 | `http_post` | 2 | http |
| 22 | `computer_screenshot` | 2 | desktop |
| 23 | `codebase_progress` | 2 | analysis |
| 24 | `ssh_key_generate` | 1 | ssh |
| 25 | `http_get` | 1 | http |

### Pattern: Top 5 = 70% of Usage

The core primitives dominate: `say`, `terminal`, `send_chat`, `file_get`, `file_put`

---

## Never Called Tools

### Entire Categories with Zero Usage

| Category | Tools | Count |
|----------|-------|-------|
| Calendar | `calendar_*` | 5 |
| Gmail | `gmail_*` | 4 |
| Tasks | `tasks_*` | 6 |
| Docs | `docs_*` | 4 |
| Sheets | `sheets_*` | 5 |
| Contacts | `contacts_*` | 4 |
| Queue | `queue_*` | 4 |
| Perplexity | `perplexity_*` | 4 |
| Tavily | `tavily_*` | 3 |

**Note:** Zero usage doesn't mean remove. It means these belong to specialists (DocuBot) who haven't been invoked yet.

---

## The 7 Core Primitives

### Renamed for Clarity

| Current | New | Purpose |
|---------|-----|---------|
| `terminal_execute` | `terminal` | Non-interactive shell |
| `file_get` | `get` | Read file or URL |
| `file_put` | `put` | Write file |
| `send_chat` | `write` | Output to chat |
| `log_append` | `log` | Append to log file |
| `say` | `say` | HD voice output |
| *(new)* | `ssh` | Persistent 2-way connection |

### Why These 7?

With these primitives, you can do anything:

```bash
# List files
terminal "ls -la"

# Read a file
get "/path/to/file"

# Write a file
put "/path/to/file" "content"

# Send output
write "Here's what I found..."

# Log activity
log "execution" "Completed analysis"

# Speak
say "Task complete"

# Remote execution
ssh "server" "command"
```

---

## Removal Candidates

### Replace with Filesystem

| Tool | Replacement |
|------|-------------|
| `queue_create` | `put /queues/worker/job.json` |
| `queue_list` | `terminal "ls /queues/worker/"` |
| `queue_start` | Worker polls directory |
| `queue_batch` | Multiple `put` calls |

### Replace with Shell

| Tool | Replacement |
|------|-------------|
| `open_url` | `terminal "xdg-open URL"` |
| `codebase_analyze` | Shell script |
| `codebase_progress` | `get /status/analysis.json` |

### Replace with SSH

| Tool | Replacement |
|------|-------------|
| `ssh_host_list` | Config file |
| `ssh_host_add` | Config file write |
| `ssh_host_delete` | Config file edit |
| `ssh_key_list` | `terminal "ls ~/.ssh/"` |
| `ssh_key_generate` | `terminal "ssh-keygen..."` |
| `ssh_connect` | `ssh "host"` persistent |
| `ssh_disconnect` | Close connection |
| `ssh_execute` | `ssh "host" "command"` |
| `ssh_status` | Connection object state |

---

## Keep: Free Tier Search

| Tool | Status | Reason |
|------|--------|--------|
| `web_search` | ✅ KEEP | Google grounding, free tier |
| `google_search` | ✅ KEEP | Free quota |
| `duckduckgo_search` | ✅ KEEP | Always free |
| `browser_scrape` | ✅ KEEP | Direct page fetch |
| `browserbase_load` | ✅ KEEP | Headless browser |
| `browserbase_screenshot` | ✅ KEEP | Visual capture |

### Remove: Paid Search

| Tool | Status | Reason |
|------|--------|--------|
| `perplexity_search` | ❌ REMOVE | No free tier |
| `perplexity_research` | ❌ REMOVE | No free tier |
| `perplexity_news` | ❌ REMOVE | No free tier |
| `perplexity_quick` | ❌ REMOVE | No free tier |
| `tavily_search` | ❌ REMOVE | No free tier |
| `tavily_research` | ❌ REMOVE | No free tier |
| `tavily_qna` | ❌ REMOVE | No free tier |

---

## Keep: Database Tools

| Tool | Status | Notes |
|------|--------|-------|
| `db_tables` | ✅ KEEP | Schema inspection |
| `db_query` | ✅ KEEP | Direct SQL |
| `db_insert` | ✅ KEEP | Data creation |
| `db_delete` | ✅ KEEP | Data removal |

**Plan:** Expand with DB specialist agent.

---

## Load on Demand: Desktop Control

Only inject into context when desktop collaboration mode is active:

| Tool | Category |
|------|----------|
| `computer_screenshot` | capture |
| `computer_click` | input |
| `computer_move` | input |
| `computer_type` | input |
| `computer_key` | input |
| `computer_scroll` | input |
| `computer_wait` | timing |

---

## Specialist Tool Assignment

### DocuBot (Google Workspace)

```
docs_read, docs_create, docs_append, docs_replace
sheets_read, sheets_create, sheets_write, sheets_append, sheets_clear
drive_list, drive_read, drive_search, drive_create, drive_update, drive_delete
```

### CommBot (Communication)

```
gmail_list, gmail_read, gmail_search, gmail_send
sms_send, sms_list
call_make, call_list
contacts_list, contacts_search, contacts_create, contacts_update
```

### CalBot (Calendar/Tasks)

```
calendar_list, calendar_events, calendar_create, calendar_update, calendar_delete
tasks_list, tasks_create, tasks_update, tasks_delete, tasks_complete
```

### CodeBot (GitHub/Analysis)

```
github_repos, github_repo_create, github_repo_fork
github_contents, github_code_search
github_file_read, github_file_create
github_branch_list, github_branch_create, github_branch_delete
github_issues, github_issue_create, github_issue_update, github_issue_comment
github_pulls, github_pr_create, github_pr_merge, github_pr_review_request
github_commits, github_milestones, github_labels
github_release_create, github_workflows_list, github_actions_trigger
```

---

## Complete Tool List (102)

### Communication (5)
| # | Tool | Status |
|---|------|--------|
| 1 | `send_chat` → `write` | ✅ CORE |
| 2 | `say` | ✅ CORE |
| 3 | `sms_send` | ✅ CommBot |
| 4 | `sms_list` | ✅ CommBot |
| 5 | `open_url` | ❌ REMOVE (use terminal) |

### File System (4)
| # | Tool | Status |
|---|------|--------|
| 6 | `file_get` → `get` | ✅ CORE |
| 7 | `file_put` → `put` | ✅ CORE |
| 8 | `terminal_execute` → `terminal` | ✅ CORE |
| 9 | `log_append` → `log` | ✅ CORE |

### Voice Calls (2)
| # | Tool | Status |
|---|------|--------|
| 10 | `call_make` | ✅ CommBot |
| 11 | `call_list` | ✅ CommBot |

### Gmail (4)
| # | Tool | Status |
|---|------|--------|
| 12 | `gmail_list` | ✅ CommBot |
| 13 | `gmail_read` | ✅ CommBot |
| 14 | `gmail_search` | ✅ CommBot |
| 15 | `gmail_send` | ✅ CommBot |

### Calendar (5)
| # | Tool | Status |
|---|------|--------|
| 16 | `calendar_list` | ✅ CalBot |
| 17 | `calendar_events` | ✅ CalBot |
| 18 | `calendar_create` | ✅ CalBot |
| 19 | `calendar_update` | ✅ CalBot |
| 20 | `calendar_delete` | ✅ CalBot |

### Google Drive (6)
| # | Tool | Status |
|---|------|--------|
| 21 | `drive_list` | ✅ DocuBot |
| 22 | `drive_read` | ✅ DocuBot |
| 23 | `drive_search` | ✅ DocuBot |
| 24 | `drive_create` | ✅ DocuBot |
| 25 | `drive_update` | ✅ DocuBot |
| 26 | `drive_delete` | ✅ DocuBot |

### Google Docs (4)
| # | Tool | Status |
|---|------|--------|
| 27 | `docs_read` | ✅ DocuBot |
| 28 | `docs_create` | ✅ DocuBot |
| 29 | `docs_append` | ✅ DocuBot |
| 30 | `docs_replace` | ✅ DocuBot |

### Google Sheets (5)
| # | Tool | Status |
|---|------|--------|
| 31 | `sheets_read` | ✅ DocuBot |
| 32 | `sheets_create` | ✅ DocuBot |
| 33 | `sheets_write` | ✅ DocuBot |
| 34 | `sheets_append` | ✅ DocuBot |
| 35 | `sheets_clear` | ✅ DocuBot |

### Google Tasks (5)
| # | Tool | Status |
|---|------|--------|
| 36 | `tasks_list` | ✅ CalBot |
| 37 | `tasks_create` | ✅ CalBot |
| 38 | `tasks_update` | ✅ CalBot |
| 39 | `tasks_delete` | ✅ CalBot |
| 40 | `tasks_complete` | ✅ CalBot |

### Contacts (4)
| # | Tool | Status |
|---|------|--------|
| 41 | `contacts_list` | ✅ CommBot |
| 42 | `contacts_search` | ✅ CommBot |
| 43 | `contacts_create` | ✅ CommBot |
| 44 | `contacts_update` | ✅ CommBot |

### GitHub (24)
| # | Tool | Status |
|---|------|--------|
| 45-68 | `github_*` (all 24) | ✅ CodeBot |

### SSH (9)
| # | Tool | Status |
|---|------|--------|
| 69-77 | `ssh_*` (all 9) | ❌ CONSOLIDATE to `ssh` |

### Database (4)
| # | Tool | Status |
|---|------|--------|
| 78 | `db_tables` | ✅ KEEP (DBBot) |
| 79 | `db_query` | ✅ KEEP (DBBot) |
| 80 | `db_insert` | ✅ KEEP (DBBot) |
| 81 | `db_delete` | ✅ KEEP (DBBot) |

### Browser (3)
| # | Tool | Status |
|---|------|--------|
| 82 | `browser_scrape` | ✅ SearchBot |
| 83 | `browserbase_load` | ✅ SearchBot |
| 84 | `browserbase_screenshot` | ✅ SearchBot |

### Computer Control (7)
| # | Tool | Status |
|---|------|--------|
| 85-91 | `computer_*` (all 7) | ✅ ON-DEMAND |

### HTTP (3)
| # | Tool | Status |
|---|------|--------|
| 92 | `http_get` | ✅ General |
| 93 | `http_post` | ✅ General |
| 94 | `http_put` | ✅ General |

### Codebase (2)
| # | Tool | Status |
|---|------|--------|
| 95 | `codebase_analyze` | ❌ REMOVE (shell script) |
| 96 | `codebase_progress` | ❌ REMOVE (file read) |

### Queue (4)
| # | Tool | Status |
|---|------|--------|
| 97-100 | `queue_*` (all 4) | ❌ REMOVE (filesystem) |

### Search (1)
| # | Tool | Status |
|---|------|--------|
| 101 | `web_search` | ✅ SearchBot |

### Control (1)
| # | Tool | Status |
|---|------|--------|
| 102 | `end_turn` | ❓ REVIEW |

---

## Post-Consolidation Summary

| Category | Before | After |
|----------|--------|-------|
| Core Primitives | 0 | 7 |
| Removed | 0 | ~20 |
| Specialist Tools | 102 | ~75 |
| On-Demand | 0 | 7 |

### Final Tool Distribution

```
CORE (always loaded):     7 tools
DocuBot:                 15 tools
CommBot:                 12 tools
CalBot:                  10 tools
CodeBot:                 24 tools
SearchBot:                6 tools
DBBot:                    4 tools
Desktop (on-demand):      7 tools
─────────────────────────────────
TOTAL:                   ~85 tools (down from 102)
```

---

*Less is more. The right tool for the right job.*
