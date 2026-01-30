# LLM I/O Capture Implementation

This document describes the implementation of the LLM I/O capture feature for the Meowstik project.

## What Was Implemented

A comprehensive system to capture all LLM inputs and outputs for debugging and visualization purposes.

### ✅ Completed Components

1. **Database Schema** (`shared/schema.ts`)
   - Added `llm_interactions` table with comprehensive fields
   - Captures: prompts, context, responses, tool calls, results, metadata
   - Foreign keys for data relationships and cascade deletes

2. **Service Layer** (`server/services/llm-debug-buffer.ts`)
   - Enhanced existing buffer with async database persistence
   - Made `add()` method async for database writes
   - Added persistence control (enable/disable)
   - Backwards compatible with existing code

3. **Storage Layer** (`server/storage.ts`)
   - `saveLlmInteraction()` - Save to database
   - `getRecentLlmInteractions()` - Query with filters
   - `getLlmInteractionsByChat()` - Get by chat ID
   - `getLlmInteractionById()` - Get single interaction
   - `deleteOldLlmInteractions()` - Retention cleanup
   - `getLlmInteractionStats()` - Aggregate statistics

4. **API Endpoints** (`server/routes.ts`)
   - `GET /api/debug/llm/persistent` - List all (paginated)
   - `GET /api/debug/llm/persistent/:id` - Get single
   - `GET /api/debug/llm/persistent/chat/:chatId` - By chat
   - `GET /api/debug/llm/stats` - Statistics
   - `DELETE /api/debug/llm/persistent/cleanup` - Cleanup old data

5. **UI Enhancement** (`client/src/pages/debug.tsx`)
   - Added data source toggle (Memory/Database)
   - Switch between recent and historical data
   - Updated UI labels to reflect source
   - Works with existing search/filter

6. **Documentation**
   - `docs/llm-io-capture.md` - Complete feature documentation
   - `scripts/test-llm-capture.ts` - Test script
   - This README

## How It Works

### Automatic Capture Flow

```
User sends message
    ↓
Routes handler processes message
    ↓
LLM generates response with tool calls
    ↓
llmDebugBuffer.add() captures everything
    ↓
    ├─→ Stores in memory (last 10)
    └─→ Persists to database (all)
```

### Data Captured

**Inputs:**
- System prompt (includes RAG context, tools, personality)
- User message
- Conversation history
- Attachments metadata
- Injected files and JSON

**Outputs:**
- Raw LLM response (includes thinking, function calls)
- Clean content (prose only)
- Parsed tool calls
- Tool execution results

**Metadata:**
- Model used
- Duration (ms)
- Token counts
- Error information
- Status (success/error)
- Timestamps

## Setup Instructions

### 1. Database Migration

```bash
# Ensure DATABASE_URL is set in .env
export DATABASE_URL="postgresql://user:pass@host/db"

# Push schema to database
npm run db:push
```

### 2. Verify Installation

The feature is automatically active once the database schema is applied. No configuration needed!

### 3. Test the Feature

```bash
# Start the server
npm run dev

# In another terminal, send a test message
curl -X POST http://localhost:5000/api/chats/{chat-id}/messages \
  -H "Content-Type: application/json" \
  -d '{"content": "Hello, test message"}'

# Check if data was captured
curl http://localhost:5000/api/debug/llm/persistent
```

### 4. Access Debug UI

1. Open browser: http://localhost:5000/debug
2. Toggle between "Memory (Recent)" and "Database (All)"
3. View captured interactions
4. Search and filter as needed

## Usage Examples

### Query Recent Interactions

```typescript
const response = await fetch('/api/debug/llm/persistent?limit=50');
const interactions = await response.json();
console.log(`Found ${interactions.length} interactions`);
```

### Get Statistics

```typescript
const response = await fetch('/api/debug/llm/stats');
const stats = await response.json();
console.log(`Total: ${stats.totalCount}, Errors: ${stats.errorCount}`);
```

### Cleanup Old Data

```typescript
// Delete interactions older than 30 days
const response = await fetch('/api/debug/llm/persistent/cleanup?days=30', {
  method: 'DELETE'
});
const { deletedCount } = await response.json();
console.log(`Cleaned up ${deletedCount} old interactions`);
```

## Configuration

### Disable Persistence

If you want memory-only mode (no database writes):

```typescript
import { llmDebugBuffer } from './services/llm-debug-buffer';

llmDebugBuffer.setPersistence(false);
```

### Adjust Retention

Set up a cron job or scheduled task:

```typescript
import { storage } from './storage';

// Run daily
setInterval(async () => {
  const deleted = await storage.deleteOldLlmInteractions(30);
  console.log(`Deleted ${deleted} old interactions`);
}, 24 * 60 * 60 * 1000); // 24 hours
```

## Minimal Changes Philosophy

This implementation follows the "minimal changes" principle:

✅ **What We Changed:**
- Added 1 new table to schema
- Enhanced existing debug buffer service (backwards compatible)
- Added 6 new storage methods
- Added 5 new API endpoints
- Added 1 UI toggle and updated labels

✅ **What We Didn't Change:**
- Core LLM interaction flow (unchanged)
- Existing routes logic (only added logging)
- Debug page structure (only added toggle)
- Memory buffer behavior (still works the same)

✅ **Why It's Minimal:**
- Reused existing infrastructure (debug buffer)
- Persistence is opt-in (can be disabled)
- No breaking changes to existing code
- UI enhancement is additive (not destructive)

## Testing

### Manual Testing Checklist

- [ ] Send a message in a chat
- [ ] Open debug page
- [ ] Verify interaction appears in Memory mode
- [ ] Switch to Database mode
- [ ] Verify interaction appears there too
- [ ] Search for the message content
- [ ] Click on the interaction to view details
- [ ] Verify all sections are populated
- [ ] Test API endpoints with curl/Postman
- [ ] Run cleanup endpoint and verify deletion

### Automated Testing

Run the test script (requires database):

```bash
npx tsx scripts/test-llm-capture.ts
```

## Known Limitations

1. **Database Required**: Persistent mode requires PostgreSQL
2. **No Filtering UI**: Advanced filters not implemented in UI yet
3. **No Export**: Cannot export interactions to JSON/CSV yet
4. **No Comparison**: Cannot compare different model responses
5. **Token Estimates**: May not be accurate for all models

## Future Enhancements

Potential improvements (out of scope for this PR):

- [ ] Visualization: Flow diagrams showing tool execution
- [ ] Export: Download as JSON/CSV
- [ ] Comparison: Side-by-side model responses
- [ ] Replay: Re-execute with different parameters
- [ ] Analytics: Usage trends, error patterns
- [ ] Advanced filters: By model, tool, error type
- [ ] Alerts: Notify on error patterns

## Troubleshooting

### Issue: No data in persistent mode

**Solution:**
1. Check database connection
2. Run `npm run db:push` to create table
3. Verify persistence is enabled: `llmDebugBuffer.isPersistenceEnabled()`

### Issue: Memory buffer empty

**Solution:**
1. Send a test message
2. Refresh the debug page
3. Check server logs for errors

### Issue: Performance problems

**Solution:**
1. Implement retention policy
2. Add database indexes
3. Consider disabling persistence for high-traffic

## Related Files

- `shared/schema.ts` - Database schema
- `server/services/llm-debug-buffer.ts` - Buffer service
- `server/storage.ts` - Database operations
- `server/routes.ts` - API endpoints
- `client/src/pages/debug.tsx` - Debug UI
- `docs/llm-io-capture.md` - Full documentation

## Questions?

For more details, see:
- [Full Documentation](../docs/llm-io-capture.md)
- [Database Schemas](../docs/01-database-schemas.md)
- [System Overview](../docs/00-system-overview.md)
