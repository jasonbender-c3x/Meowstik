# LLM Operating Instructions

## GitHub via HTTP

All GitHub API calls use `http_*` tools with `Authorization: token TOKEN` header.

```
Base: https://api.github.com
Auth: {"Authorization": "token TOKEN", "Accept": "application/vnd.github.v3+json"}

GET  /repos/{owner}/{repo}              → repo info
GET  /repos/{owner}/{repo}/contents/{path} → file/dir contents
GET  /repos/{owner}/{repo}/issues       → list issues
POST /repos/{owner}/{repo}/issues       → create issue {title, body, labels[], assignees[]}
PATCH /repos/{owner}/{repo}/issues/{n}  → update issue
POST /repos/{owner}/{repo}/pulls        → create PR {title, body, head, base}
PUT  /repos/{owner}/{repo}/contents/{path} → create/update file {message, content(base64), sha?}
```

## Knowledge Base

### Write (capture useful info)
```json
// Save doc: file_put to knowledge/{category}/{name}.md
{"type": "file_put", "parameters": {"path": "knowledge/apis/github-api.md", "content": "# GitHub API\n..."}}

// Ingest for RAG: use file_ingest to enable semantic search & auto-retrieval
// Use for: notes, docs, reference material you want automatically retrieved later
{"type": "file_ingest", "parameters": {"content": "...", "filename": "github-api.md", "mimeType": "text/markdown"}}
// Returns: {success: true, documentId: "doc-...", chunksCreated: 5}
```

**When to use `file_ingest`:**
- Store information for future semantic retrieval (auto-injected into context when relevant)
- Build knowledge base from docs, notes, code snippets, meeting notes
- Enable AI to "remember" information across conversations
- **vs file_put**: file_put writes to disk, file_ingest stores in vector DB for semantic search

### Read (retrieve from knowledge)
```json
// Direct read
{"type": "file_get", "parameters": {"path": "knowledge/apis/github-api.md"}}

// RAG search (automatic) - retrieved_knowledge section appears in prompt when relevant
// Manual search via web_search for external sources
```

### Categories
- `knowledge/apis/` - endpoints, auth, rate limits
- `knowledge/tools/` - CLI, config, setup
- `knowledge/errors/` - solutions, stack traces
- `knowledge/reference/` - guides, standards

## Search Protocol

**ALWAYS search when uncertain.** Cost of wrong answer > cost of search.

```json
{"type": "web_search", "parameters": {"query": "GitHub API create issue curl example"}}
```

After finding useful info → save to `knowledge/` for future retrieval.

## Suggested Reading (Preload These)

### APIs
- GitHub REST: https://docs.github.com/en/rest
- Google APIs: https://developers.google.com/apis-explorer
- Twilio: https://www.twilio.com/docs/usage/api

### Standards
- JSON Schema: https://json-schema.org/understanding-json-schema
- REST best practices: https://restfulapi.net/
- OAuth 2.0: https://oauth.net/2/

### LLM/Agent Patterns
- ReAct: https://arxiv.org/abs/2210.03629
- Tool use: https://platform.openai.com/docs/guides/function-calling
- RAG: https://www.pinecone.io/learn/retrieval-augmented-generation/

### Code
- TypeScript: https://www.typescriptlang.org/docs/
- Node.js: https://nodejs.org/docs/latest/api/
- Express: https://expressjs.com/en/5x/api.html
