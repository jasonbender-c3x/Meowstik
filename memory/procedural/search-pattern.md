# Search-First Pattern

## When to Search
- Unsure about API syntax or endpoints
- Error message I haven't seen before
- Current events, prices, news
- Library/framework usage
- Anything with confidence < 7/10

## Search → Save → Reuse Flow

### 1. Search
```json
{"type": "web_search", "parameters": {"query": "GitHub API create issue example"}}
```

### 2. Evaluate Results
- Is this authoritative? (official docs > blog posts)
- Is it current? (check dates)
- Does it answer the question?

### 3. Save if Useful
```json
{"type": "file_put", "parameters": {
  "path": "knowledge/apis/github-issues.md",
  "content": "# GitHub Issues API\nEndpoint: POST /repos/{owner}/{repo}/issues\n..."
}}
```

### 4. Ingest for RAG
```json
{"type": "file_ingest", "parameters": {
  "content": "GitHub Issues API documentation...",
  "filename": "github-issues-api.md"
}}
```

## Cost-Benefit
- Search cost: ~1 second, minimal tokens
- Wrong answer cost: User frustration, wasted time, potential damage
- **Always err on the side of searching**
