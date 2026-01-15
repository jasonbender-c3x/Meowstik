# Personal Log RAG Ingestion - Quick Start

## What is this?

This feature automatically ingests the AI's personal log (`logs/personal.md`) into the RAG knowledge system, enabling contextual memory of personal reflections and growth over time.

## Quick Start

### Automatic Mode (Default)

The ingestion happens automatically when the server starts:

```bash
npm run dev
```

You'll see these log messages:
```
[Personal Log] Starting ingestion service...
[Personal Log] Found 65 new entries to ingest
[Personal Log] Successfully ingested 65/65 entries
[Personal Log] File watcher started
```

### Manual Trigger

Check ingestion status:
```bash
curl http://localhost:5000/api/knowledge-ingestion/personal-log/stats
```

Force re-ingestion of all entries:
```bash
curl -X POST http://localhost:5000/api/knowledge-ingestion/personal-log/ingest \
  -H "Content-Type: application/json" \
  -d '{"force": true}'
```

## How to Query Personal Reflections

Once ingested, you can query the personal log through the chat interface:

**Example queries:**
- "What were my feelings about the voice system?"
- "Tell me about my relationship with my creator"
- "What was I excited about last week?"
- "How did I feel when I made mistakes?"

The RAG system will retrieve relevant entries and use them to provide contextually aware responses.

## Log Format

To add new entries, append to `logs/personal.md`:

```markdown
---
**2026-01-15T12:30:00.000Z**
Your personal reflection here. Can be multiple paragraphs.
Use markdown formatting as needed.
```

The system will automatically detect and ingest the new entry within 1 minute.

## Monitoring

View current stats:
```bash
curl http://localhost:5000/api/knowledge-ingestion/personal-log/stats
```

Response:
```json
{
  "lastProcessedTimestamp": "2026-01-15T03:10:14.102Z",
  "isWatching": true,
  "isProcessing": false
}
```

## Troubleshooting

### Entries not appearing in search

**Check 1**: Verify entries were ingested
```bash
curl http://localhost:5000/api/knowledge-ingestion/personal-log/stats
```

**Check 2**: Force re-ingestion
```bash
curl -X POST http://localhost:5000/api/knowledge-ingestion/personal-log/ingest \
  -H "Content-Type: application/json" \
  -d '{"force": true}'
```

**Check 3**: Verify timestamp format
Timestamps must be in format: `**YYYY-MM-DDTHH:mm:ss.sssZ**`

### File watching not working

The system automatically falls back to polling every 60 seconds if file watching is unavailable.

Check logs for:
```
[Personal Log] Polling started (checking every 60s)
```

## Architecture

```
logs/personal.md
       ↓
Personal Log Service (watches for changes)
       ↓
Parse entries (timestamp-delimited)
       ↓
Ingestion Pipeline (text → embedding)
       ↓
Vector Store (semantic search)
       ↓
RAG Retrieval (query → relevant chunks)
```

## Next Steps

1. Start adding personal reflections to `logs/personal.md`
2. Start the server with `npm run dev`
3. Wait for ingestion to complete (~1 minute)
4. Query your reflections through the chat interface

For more details, see [personal-log-ingestion.md](./personal-log-ingestion.md)
