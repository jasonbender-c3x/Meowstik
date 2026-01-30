# LLM I/O Capture System

## Overview

The LLM I/O Capture System provides comprehensive logging and visualization of all interactions with the Large Language Model (LLM). This system captures every input (prompts, context, tool calls) and output (responses, tool results) for debugging, analysis, and visualization purposes.

## Architecture

```mermaid
graph TB
    A[User Message] --> B[Routes: POST /api/chats/:id/messages]
    B --> C[Gemini LLM API]
    C --> D[LLM Response]
    D --> E[llmDebugBuffer.add()]
    E --> F[In-Memory Buffer<br/>Last 10 interactions]
    E --> G[PostgreSQL Database<br/>llm_interactions table]
    
    H[Debug UI] --> I{Data Source}
    I -->|Memory| J[GET /api/debug/llm]
    I -->|Persistent| K[GET /api/debug/llm/persistent]
    J --> F
    K --> G
```

## Features

### 1. Automatic Capture
Every LLM interaction is automatically captured without any code changes needed:
- ✅ System prompts (with RAG context, tools, personality)
- ✅ User messages and conversation history
- ✅ Attachments metadata
- ✅ RAG context injected
- ✅ Raw LLM responses (including thinking, function calls)
- ✅ Tool calls and execution results
- ✅ Performance metrics (duration, tokens)
- ✅ Error information

### 2. Dual Storage Modes

#### Memory Mode (Fast)
- Stores last 10 interactions in RAM
- Instant access
- Lost on server restart
- Minimal memory footprint

#### Persistent Mode (Complete)
- Stores all interactions in PostgreSQL
- Survives restarts
- Queryable and searchable
- Supports analysis and reporting

### 3. Debug Console UI

Access at `/debug` to view captured interactions:

**Features:**
- Toggle between Memory and Database sources
- Search across all fields
- Expandable sections for inputs/outputs
- Copy-to-clipboard for prompts and responses
- Real-time updates (5 second refresh)

## API Endpoints

### In-Memory Buffer

```
GET    /api/debug/llm              # Get recent interactions from memory
GET    /api/debug/llm/:id          # Get single interaction by ID
DELETE /api/debug/llm              # Clear memory buffer
```

### Persistent Storage

```
GET    /api/debug/llm/persistent                # Get all from database
GET    /api/debug/llm/persistent/:id            # Get single by ID
GET    /api/debug/llm/persistent/chat/:chatId   # Get by chat ID
GET    /api/debug/llm/stats                     # Get statistics
DELETE /api/debug/llm/persistent/cleanup        # Delete old records
```

## Database Schema

The `llm_interactions` table stores complete LLM I/O data:

```sql
CREATE TABLE llm_interactions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id VARCHAR REFERENCES chats(id) ON DELETE CASCADE,
  message_id VARCHAR REFERENCES messages(id) ON DELETE CASCADE,
  user_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
  
  -- Input data
  system_prompt TEXT,
  user_message TEXT,
  conversation_history JSONB,
  attachments JSONB,
  rag_context JSONB,
  injected_files JSONB,
  injected_json JSONB,
  
  -- Output data
  raw_response TEXT,
  clean_content TEXT,
  parsed_tool_calls JSONB,
  tool_results JSONB,
  
  -- Metadata
  model VARCHAR(100),
  duration_ms INTEGER,
  token_estimate JSONB,
  error TEXT,
  status VARCHAR(20) DEFAULT 'success',
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Usage Examples

### Query Recent Interactions

```typescript
// Get last 50 interactions
const response = await fetch('/api/debug/llm/persistent?limit=50');
const interactions = await response.json();
```

### Query by Chat

```typescript
// Get all interactions for a specific chat
const response = await fetch(`/api/debug/llm/persistent/chat/${chatId}`);
const chatInteractions = await response.json();
```

### Get Statistics

```typescript
// Get aggregate statistics
const response = await fetch('/api/debug/llm/stats');
const stats = await response.json();
// Returns: { totalCount, successCount, errorCount, avgDurationMs }
```

### Cleanup Old Data

```typescript
// Delete interactions older than 30 days
const response = await fetch('/api/debug/llm/persistent/cleanup?days=30', {
  method: 'DELETE'
});
const { deletedCount } = await response.json();
```

## Configuration

### Enable/Disable Persistence

Persistence is enabled by default. To disable:

```typescript
import { llmDebugBuffer } from './services/llm-debug-buffer';

// Disable database persistence (memory only)
llmDebugBuffer.setPersistence(false);
```

### Control What Gets Captured

Edit `server/routes.ts` around line 1227 to customize what gets captured:

```typescript
await llmDebugBuffer.add({
  chatId: req.params.id,
  messageId: savedMessage.id,
  userId: userId,
  systemPrompt: modifiedPrompt.systemPrompt,
  userMessage: composedPrompt.userMessage,
  // ... add or remove fields as needed
});
```

## Data Retention

### Recommended Policies

1. **Development**: Keep all data for debugging
2. **Staging**: 30-day retention
3. **Production**: 7-14 day retention (or archive to cold storage)

### Implementing Retention

Set up a cron job to clean old data:

```typescript
// Run daily at 2 AM
import { storage } from './storage';

async function cleanupOldInteractions() {
  const days = 30; // Keep last 30 days
  const deleted = await storage.deleteOldLlmInteractions(days);
  console.log(`Deleted ${deleted} old LLM interactions`);
}
```

## Privacy Considerations

The LLM interactions table may contain sensitive user data:

- ✅ User messages and conversation context
- ✅ RAG context from documents
- ✅ Tool results (may include API responses)

**Best Practices:**
1. Apply appropriate database-level access controls
2. Consider PII scrubbing before persistence
3. Implement data retention policies
4. Enable row-level security for multi-tenant deployments
5. Encrypt sensitive fields if required by compliance

## Troubleshooting

### Issue: No data appearing in persistent mode

**Check:**
1. Database connection is working: `SELECT COUNT(*) FROM llm_interactions;`
2. Persistence is enabled: `llmDebugBuffer.isPersistenceEnabled()`
3. Check server logs for database errors

### Issue: Memory buffer not updating

**Check:**
1. Server is running
2. LLM interactions are happening (send a test message)
3. Check browser console for API errors

### Issue: Performance degradation

**Solutions:**
1. Implement retention policy to limit table size
2. Add indexes on frequently queried fields
3. Consider archiving old data to separate table
4. Disable persistence in high-traffic scenarios

## Future Enhancements

Potential improvements for this system:

- [ ] **Visualization**: Flow diagrams showing tool execution
- [ ] **Export**: Download interactions as JSON/CSV
- [ ] **Comparison**: Side-by-side comparison of different model responses
- [ ] **Replay**: Re-execute interactions with different parameters
- [ ] **Analytics**: Token usage trends, error patterns
- [ ] **Filtering**: Advanced filters (by model, tool, error type)
- [ ] **Alerts**: Notify on error patterns or performance issues

## Related Documentation

- [Database Schemas](./01-database-schemas.md)
- [Prompt Lifecycle](./03-prompt-lifecycle.md)
- [System Overview](./00-system-overview.md)
