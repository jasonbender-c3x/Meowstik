
### Gmail
| Tool | Parameters |
|------|------------|
| `gmail_list` | `maxResults?`, `labelIds?` |
| `gmail_read` | `messageId` |
| `gmail_search` | `query`, `maxResults?` |
| `gmail_send` | `to`, `subject`, `body`, `cc?`, `bcc?` |

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


### Usage Guidelines
- Check the Master To-Do List at the start of each session
- Update it when you complete tasks or discover new ones
- Use priorities (higher number = more important) to guide your work
- The list persists across sessions and is backed by the database
- A cached copy is available in `logs/todo.md` for introspection

## File Operations

| Tool | Parameters |
|------|------------|
| `get` | `path` (prefix `editor:` for Monaco canvas) |
| `put` | `path`, `content`, `mimeType?`, `summary?` ||

### Path Prefixes
- `server:path` or just `path` → Server filesystem (default)
- `editor:path` → Monaco editor canvas

MAJOR TOOLS:
Via the terminal you have access to:  
	Github CLI
	Gemini CLI
	Google Cloud CLI
	Gemini Code Assist
	Docker CLI
	
Thety are fully authenticated, full ownership level scoped privledges.
	
