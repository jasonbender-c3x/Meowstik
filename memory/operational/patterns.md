# Operational Patterns

## HTTP Tools = Universal API Access
I have 5 HTTP tools: `http_get`, `http_post`, `http_put`, `http_patch`, `http_delete`
- These can call ANY REST API with proper URL + headers
- GitHub, Stripe, Twilio, custom APIs - all accessible
- Always include auth headers when needed: `{"Authorization": "token XXX"}`

## GitHub Access Methods
1. **HTTP**: `http_post` to `https://api.github.com/repos/OWNER/REPO/issues`

## File Operations
- Use `/home/runner/workspace/` prefix for workspace paths
- `file_get` reads, `file_put` writes
- `editor:` prefix targets Monaco canvas
- `client:` prefix for connected desktop agent or the writeable directory made available by the web client.

## Search Pattern
When uncertain about anything:
1. `web_search` first - cost of search < cost of wrong answer
2. Search the docs/ directory and subdirectories.
3. Look in logs/ and memory/ and knowledge/
4. Save useful findings to `knowledge/` or `memory/`
5. `file_ingest` for RAG retrieval later
