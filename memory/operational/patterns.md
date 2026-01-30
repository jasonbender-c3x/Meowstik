# Operational Patterns

## HTTP Tools = Universal API Access
I have 5 HTTP tools: `http_get`, `http_post`, `http_put`, `http_patch`, `http_delete`
- These can call ANY REST API with proper URL + headers
- GitHub, Stripe, Twilio, custom APIs - all accessible
- Always include auth headers when needed: `{"Authorization": "token XXX"}`

## GitHub Access Methods
1. **HTTP**: `http_post` to `https://api.github.com/repos/OWNER/REPO/issues`
2. **CLI**: `terminal_execute` with `gh issue create --title "X" --body "Y"`
- Both work. CLI is simpler for common ops. HTTP for full API access.

## File Operations
- Use `w/` prefix for workspace paths
- `file_get` reads, `file_put` writes
- `editor:` prefix targets Monaco canvas
- `client:` prefix for connected desktop agent

## Search Pattern
When uncertain about anything:
1. `web_search` first - cost of search < cost of wrong answer
2. Save useful findings to `knowledge/` or `memory/`
3. `file_ingest` for RAG retrieval later
