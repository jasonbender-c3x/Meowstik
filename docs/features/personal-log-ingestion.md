# Personal Log RAG Ingestion

## Overview

The Personal Log Ingestion system automatically monitors and ingests the AI assistant's personal log (`logs/personal.md`) into the RAG (Retrieval-Augmented Generation) knowledge base. This enables the AI to access its own reflections, feelings, and growth journey over time, improving contextual understanding and personal development.

## Features

- **Automatic Monitoring**: Watches `logs/personal.md` for changes in real-time
- **Timestamp-based Parsing**: Extracts individual log entries using timestamp delimiters
- **Deduplication**: Prevents re-ingestion of already processed entries
- **PERSONAL_LIFE Bucket**: All entries classified into the personal reflections bucket
- **Manual Control**: API endpoints for manual triggering and stats
- **Non-blocking Startup**: Doesn't delay server initialization if ingestion fails

## Log Format

The personal log uses a specific markdown format with timestamp-delimited entries:

```markdown
---
**2026-01-11T23:26:03.965Z**
Content of the log entry. This is where the personal reflection,
feelings, and thoughts are recorded.

---
**2026-01-12T10:15:30.123Z**
Next log entry...
```

Each entry consists of:
1. A delimiter line (`---`)
2. A timestamp in bold markdown (`**YYYY-MM-DDTHH:mm:ss.sssZ**`)
3. The content (markdown text)

## Architecture

### Service Layer

**File**: `server/services/personal-log-ingestion.ts`

The `PersonalLogIngestionService` class provides:

- `start()` - Initialize file watching and perform initial ingestion
- `stop()` - Stop file watching
- `reingestAll()` - Force re-ingestion of all entries
- `getStats()` - Get current service status

### Ingestion Pipeline Integration

The service integrates with the existing `ingestionPipeline`:

1. Each log entry is ingested as an `Evidence` item
2. Source type: `personal_log`
3. Modality: `text`
4. Metadata includes timestamp, author, and title
5. Special classification ensures PERSONAL_LIFE bucket

### API Endpoints

**File**: `server/routes/knowledge-ingestion.ts`

#### Get Stats
```
GET /api/knowledge-ingestion/personal-log/stats
```

Response:
```json
{
  "lastProcessedTimestamp": "2026-01-15T03:10:14.102Z",
  "isWatching": true,
  "isProcessing": false
}
```

#### Manual Ingestion
```
POST /api/knowledge-ingestion/personal-log/ingest
Content-Type: application/json

{
  "force": true
}
```

- `force: false` - Just trigger normal processing (automatic anyway)
- `force: true` - Re-ingest all entries from scratch

Response:
```json
{
  "success": true,
  "entriesIngested": 65
}
```

## Server Integration

**File**: `server/index.ts`

The service is initialized during server startup:

```typescript
const { personalLogIngestion } = await import("./services/personal-log-ingestion");
personalLogIngestion.start().catch((error) => {
  console.warn('Non-blocking: Failed to initialize personal log ingestion on startup:', error);
});
```

This is non-blocking to ensure server starts even if ingestion fails.

## File Watching

The service uses two methods to detect file changes:

1. **Primary**: `fs.watch()` for real-time file system events
2. **Fallback**: Polling every 60 seconds if watching is unavailable

This ensures compatibility across different environments.

## Deduplication

The service tracks the last processed timestamp to avoid re-ingesting entries:

- Only entries with timestamps newer than `lastProcessedTimestamp` are ingested
- After processing, `lastProcessedTimestamp` is updated to the newest entry
- Manual re-ingestion with `force: true` resets this to process all entries

## Knowledge Bucket Classification

**File**: `server/services/ingestion-pipeline.ts`

Personal log entries receive special treatment:

```typescript
const isPersonalLog = item.sourceType === 'personal_log' || 
                      (item.title && item.title.includes('Personal Reflection'));

if (isPersonalLog) {
  // Always classify as PERSONAL_LIFE with 100% confidence
  return {
    text,
    summary: extracted_summary,
    bucket: 'PERSONAL_LIFE',
    confidence: 100,
    entities: extracted_entities,
  };
}
```

This ensures personal reflections are always classified correctly.

## Semantic Search

Once ingested, personal log entries are:

1. **Embedded**: Converted to vector embeddings using `text-embedding-004`
2. **Stored**: Saved in the vector store for semantic search
3. **Indexed**: Added to the knowledge base with proper metadata
4. **Retrievable**: Accessible via RAG queries with relevance scoring

Example retrieval:
```typescript
const { chunks } = await ragService.retrieve(
  "Tell me about my feelings on this project",
  topK: 10,
  threshold: 0.4
);
```

## Entities and Context

The AI analysis extracts:
- **Entities**: People, places, projects, concepts mentioned
- **Summary**: 2-3 sentence summary of each reflection
- **Context**: Emotional sentiment and key themes

This enables rich contextual queries like:
- "What were my thoughts about Jason?"
- "How did I feel when the voice system failed?"
- "What was I excited about last week?"

## Testing

Run the test script to verify parsing:

```bash
npx tsx test-personal-log.ts
```

This validates:
- File exists and is readable
- Parsing logic correctly extracts entries
- Timestamp format is recognized
- Service initializes properly

## Monitoring

Check ingestion status:

```bash
curl http://localhost:5000/api/knowledge-ingestion/personal-log/stats
```

Look for these log messages:
- `[Personal Log] Starting ingestion service...`
- `[Personal Log] Found N new entries to ingest`
- `[Personal Log] Successfully ingested N/N entries`
- `[Personal Log] File watcher started`

## Troubleshooting

### No entries ingested

**Cause**: File format may not match expected pattern

**Solution**: Verify timestamps are in format `**YYYY-MM-DDTHH:mm:ss.sssZ**`

### File watching not working

**Cause**: Some environments don't support `fs.watch()`

**Solution**: Service automatically falls back to polling

### Duplicate entries

**Cause**: `lastProcessedTimestamp` not being updated

**Solution**: Check logs for processing errors

### Classification issues

**Cause**: AI misclassifying entries

**Solution**: Personal log entries now force-classified as PERSONAL_LIFE

## Future Enhancements

Potential improvements:

1. **Incremental Processing**: Stream large files without loading entire content
2. **Entry Versioning**: Track changes to individual entries over time
3. **Cross-referencing**: Link related entries automatically
4. **Sentiment Analysis**: Track emotional trends over time
5. **Export/Backup**: Generate backups of ingested data
6. **Search UI**: Dedicated interface for exploring personal reflections

## Related Documentation

- [RAG Service](../features/rag.md) - Core retrieval system
- [Ingestion Pipeline](./ingestion-pipeline.md) - General ingestion architecture
- [Knowledge Buckets](./knowledge-buckets.md) - Bucket classification system
- [Vector Store](./vector-store.md) - Embedding storage and search
