# Knowledge Base

Preloaded documents and links for RAG retrieval. Save useful findings here for future lookups.

## Structure

- **`apis/`** - API docs, endpoints, auth patterns, rate limits
- **`tools/`** - CLI commands, config examples, setup guides
- **`errors/`** - Common errors and solutions, stack traces
- **`reference/`** - Tutorials, guides, best practices, standards

## File Format

Use `.md` for ingestible content or `.link` files with just a URL for reference:

```markdown
# api-name.md
Title: GitHub REST API
URL: https://docs.github.com/en/rest
Notes: Rate limit 5000/hr authenticated, 60/hr unauthenticated
```

## Auto-Ingestion

Files in this directory can be ingested into RAG with `file_ingest` for semantic search.
